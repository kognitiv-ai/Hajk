import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Overlay from "ol/Overlay";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { getDistance } from "ol/sphere";
import { getPointResolution, toLonLat } from "ol/proj";
import LineString from "ol/geom/LineString";
import Feature from "ol/Feature";
import { boundingExtent, buffer } from "ol/extent";
import { NO_STREET } from "./utils";
import SweluxApi from "./api";
import { litStretches } from "./highlight";
import {
  groupByStreet,
  readLightPoint,
  streetKey,
  streetStats,
} from "./streets";

// Colours follow the swelux palette; pass/fail match the plugin's result table.
const AMBER = "#F2B544";
const NAVY = "#10162A";
const PASS = "#2E9B66";
const FAIL = "#D2603A";

// How long to look for the light point layer before saying it is missing.
const LAYER_WAIT_MS = 30000;
const LAYER_POLL_MS = 500;
// Features arrive in batches; index the streets once a batch has settled.
const REINDEX_DELAY_MS = 300;

/**
 * @summary Map side of the Swelux plugin: finds the street behind a clicked
 * light point, keeps per-street statistics, highlights the selected street and
 * talks to the swelux.ai map API for one organisation.
 */
export default class SweluxModel {
  #map;
  #app;
  #localObserver;
  #options;
  #streets = new Map(); // streetId -> { key, name, area, points: Feature[], stats }
  #roads = []; // road segment centrelines: { key: streetId, feature }
  #highlightSource = new VectorSource();
  #highlightLayer;
  #selected = null;
  #verdict = null; // null | "pass" | "fail"
  #popupElement = document.createElement("div");
  #popup;
  #windowOpen = false;
  #pointerCursor = false;
  #context = null; // { id, name, slug, canSwitch, lightPointCount } from contextUrl
  #fitted = false;
  #layerProblem = null; // null | "missing" | "notVector"
  #source = null; // the light point layer's vector source, once found
  #reindexTimer = null;
  #layerTimer = null;

  constructor(settings) {
    this.#map = settings.map;
    this.#app = settings.app;
    this.#localObserver = settings.localObserver;
    this.#options = settings.options;
    this.api = new SweluxApi(this.#options, this.#resolve);

    this.#highlightLayer = new VectorLayer({
      source: this.#highlightSource,
      zIndex: 5000,
      layerType: "system",
      name: "pluginSweluxHighlight",
      caption: "Swelux – vald gata",
      style: this.#highlightStyle,
    });
    this.#map.addLayer(this.#highlightLayer);
    this.#popup = new Overlay({
      element: this.#popupElement,
      positioning: "bottom-center",
      offset: [0, -14],
      stopEvent: true,
      autoPan: { animation: { duration: 250 }, margin: 48 },
    });
    this.#map.addOverlay(this.#popup);
    this.#map.on("singleclick", this.#handleMapClick);
    this.#map.on("pointermove", this.#handlePointerMove);
    this.#loadRoads();
    this.#loadContext();
    this.#findLightPointLayer(Date.now());
  }

  // "{tenantId}" in apiBase, streetsUrl and contextUrl is replaced by the
  // organisation id: the tenantId option, or the value of the cookie named by
  // tenantIdCookie (set by a sign-in gateway that lets the user pick an
  // organisation).
  #tenantId = () => {
    if (this.#options.tenantId) return this.#options.tenantId;
    const name = this.#options.tenantIdCookie;
    if (!name) return "";
    const cookie = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
  };

  #resolve = (url) =>
    url.replace("{tenantId}", encodeURIComponent(this.#tenantId()));

  getStreets = () =>
    [...this.#streets.values()]
      .filter((s) => s.key !== NO_STREET)
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  getStreet = (key) => this.#streets.get(key) || null;

  getContext = () => this.#context;

  getLayerProblem = () => this.#layerProblem;

  // Which organisation's data is shown, and how much of it there is.
  #loadContext = async () => {
    if (!this.#options.contextUrl) return;
    try {
      this.#context = await this.api.get(this.#options.contextUrl);
      this.#localObserver.publish("swelux.context", this.#context);
    } catch (error) {
      console.warn("Swelux: could not load the map context", error);
    }
  };

  // Hajk may add the light point layer after the plugin starts, so look for it
  // for a while. Once found, index its features now and whenever they change:
  // a layer that loads by extent adds features as the user pans.
  #findLightPointLayer = (startedAt) => {
    const layer = this.#lightPointLayer();
    if (!layer) {
      if (Date.now() - startedAt > LAYER_WAIT_MS) {
        this.#reportLayerProblem("missing");
        return;
      }
      this.#layerTimer = setTimeout(
        () => this.#findLightPointLayer(startedAt),
        LAYER_POLL_MS
      );
      return;
    }
    const source = layer.getSource();
    // A WMS layer is a picture: there are no light points to click or group.
    if (typeof source?.getFeatures !== "function") {
      this.#reportLayerProblem("notVector");
      return;
    }
    this.#source = source;
    source.on("change", this.#scheduleReindex);
    this.#reindex();
  };

  #reportLayerProblem = (problem) => {
    this.#layerProblem = problem;
    this.#localObserver.publish("swelux.layerProblem", problem);
  };

  #scheduleReindex = () => {
    clearTimeout(this.#reindexTimer);
    this.#reindexTimer = setTimeout(this.#reindex, REINDEX_DELAY_MS);
  };

  #reindex = () => {
    const features = this.#source.getFeatures();
    if (features.length === 0) return;
    this.#indexStreets(features);
    this.#fitToData(features);
  };

  // One map can serve several organisations, so start where the light points are.
  #fitToData = (features) => {
    if (!this.#options.fitToData || this.#fitted) return;
    this.#fitted = true;
    const extent = boundingExtent(
      features.map((f) => f.getGeometry().getCoordinates())
    );
    this.#map.getView().fit(buffer(extent, 200), {
      duration: 300,
      maxZoom: 16,
      padding: [40, 40, 40, 40],
    });
  };

  #lightPointLayer = () =>
    this.#map
      .getAllLayers()
      .find((l) => l.get("name") === this.#options.lightPointLayerId);

  // A light point's properties, read through the configured property names.
  #read = (feature) =>
    readLightPoint((name) => feature.get(name), this.#options.properties);

  #streetKey = (feature) => streetKey(this.#read(feature));

  #indexStreets = (features) => {
    // Distances are measured on the ellipsoid, from the map's own projection,
    // so the spacing is right in SWEREF 99 as well as in Web Mercator.
    const projection = this.#map.getView().getProjection();
    const entries = features.map((feature) => ({
      feature,
      point: this.#read(feature),
      lonLat: toLonLat(feature.getGeometry().getCoordinates(), projection),
    }));
    this.#streets.clear();
    groupByStreet(entries).forEach((group, key) => {
      this.#streets.set(key, {
        key,
        name: group[0].point.street || "Okänd gata",
        area: group[0].point.area || "",
        points: group.map((e) => e.feature),
        stats: streetStats(group, getDistance),
      });
    });
    if (this.#selected) {
      this.#selected = this.#streets.get(this.#selected.key) || null;
    }
    this.#localObserver.publish("swelux.streetsReady", this.getStreets());
  };

  #loadRoads = async () => {
    if (!this.#options.streetsUrl) return;
    try {
      const geojson = await this.api.get(this.#options.streetsUrl);
      const features = new GeoJSON().readFeatures(geojson, {
        dataProjection: "EPSG:4326",
        featureProjection: this.#map.getView().getProjection(),
      });
      this.#roads = features
        .filter((f) => f.get("streetId") != null)
        .map((f) => ({ key: String(f.get("streetId")), feature: f }));
    } catch (error) {
      console.warn("Swelux: could not load street geometries", error);
    }
  };

  #lightPointAt = (pixel) => {
    const layer = this.#lightPointLayer();
    if (!layer || !layer.getVisible()) return null;
    let hit = null;
    this.#map.forEachFeatureAtPixel(
      pixel,
      (f) => {
        hit = f;
        return true;
      },
      { layerFilter: (l) => l === layer, hitTolerance: 6 }
    );
    return hit;
  };

  // With the window closed a click opens a popup at the pole; with it open the
  // click goes straight to the window, so stepping through streets stays quick.
  #handleMapClick = (e) => {
    const hit = this.#lightPointAt(e.pixel);
    if (!hit) {
      if (this.#popup.getPosition()) {
        this.closePopup();
        if (!this.#windowOpen) this.clearSelection();
      }
      return;
    }
    const key = this.#streetKey(hit);
    if (this.#windowOpen) {
      this.closePopup();
      this.selectStreet(key, hit);
      return;
    }
    this.selectStreet(key, hit);
    this.#popup.setPosition(hit.getGeometry().getCoordinates());
    this.#localObserver.publish("swelux.popup", {
      street: this.#streets.get(key),
      point: this.#pointInfo(hit),
      feature: hit,
    });
  };

  #handlePointerMove = (e) => {
    if (e.dragging) return;
    const over = !!this.#lightPointAt(e.pixel);
    if (over === this.#pointerCursor) return;
    this.#pointerCursor = over;
    this.#map.getTargetElement().style.cursor = over ? "pointer" : "";
  };

  #pointInfo = (f) => {
    const p = this.#read(f);
    return {
      id: p.id,
      poleId: p.poleId,
      existingLuminaire: p.existingLuminaire,
      existingManufacturer: p.existingManufacturer,
      existingWattage: p.existingWattage,
    };
  };

  getPopupElement = () => this.#popupElement;

  closePopup = () => {
    this.#popup.setPosition(undefined);
    this.#localObserver.publish("swelux.popup", null);
  };

  // "Beräkna belysning för gatan" in the popup.
  openStreetFromPopup = (key, feature) => {
    this.closePopup();
    this.#app.globalObserver.publish("swelux.showWindow", {
      hideOtherPluginWindows: true,
      runCallback: true,
    });
    this.selectStreet(key, feature, true);
  };

  setWindowOpen = (open) => {
    this.#windowOpen = open;
    if (open) this.closePopup();
  };

  selectStreet = (key, clickedFeature = null, zoom = false) => {
    const street = this.#streets.get(key);
    if (!street) return;
    this.#selected = street;
    this.#verdict = null;
    this.#drawHighlight();
    if (zoom) {
      const extent = boundingExtent(
        street.points.map((p) => p.getGeometry().getCoordinates())
      );
      this.#map.getView().fit(buffer(extent, 120), {
        duration: 400,
        maxZoom: 17,
        padding: [40, 40, 40, 460],
      });
    }
    this.#localObserver.publish("swelux.streetSelected", {
      street,
      clicked: clickedFeature ? this.#pointInfo(clickedFeature) : null,
    });
  };

  setVerdict = (verdict) => {
    this.#verdict = verdict;
    this.#highlightLayer.changed();
  };

  clearSelection = () => {
    this.#selected = null;
    this.#verdict = null;
    this.#highlightSource.clear();
  };

  #drawHighlight = () => {
    this.#highlightSource.clear();
    const street = this.#selected;
    if (!street) return;
    const pointCoords = street.points.map((p) =>
      p.getGeometry().getCoordinates()
    );
    const view = this.#map.getView();
    const unitsPerMetre =
      1 / getPointResolution(view.getProjection(), 1, pointCoords[0]);
    const roads = this.#roads
      .filter((r) => r.key === street.key)
      .flatMap((r) => lineStrings(r.feature.getGeometry()))
      .flatMap((coords) => litStretches(coords, pointCoords, unitsPerMetre))
      .map((coords) => new Feature(new LineString(coords)));
    roads.forEach((f) => f.set("kind", "road"));
    const points = street.points.map((p) => {
      const c = p.clone();
      c.set("kind", "point");
      return c;
    });
    this.#highlightSource.addFeatures([...roads, ...points]);
  };

  #highlightStyle = (feature) => {
    const tone =
      this.#verdict === "pass" ? PASS : this.#verdict === "fail" ? FAIL : AMBER;
    if (feature.get("kind") === "road") {
      return [
        new Style({ stroke: new Stroke({ color: NAVY, width: 9 }) }),
        new Style({ stroke: new Stroke({ color: tone, width: 6 }) }),
      ];
    }
    return new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: tone }),
        stroke: new Stroke({ color: NAVY, width: 2 }),
      }),
    });
  };

  dispose = () => {
    clearTimeout(this.#layerTimer);
    clearTimeout(this.#reindexTimer);
    this.#source?.un("change", this.#scheduleReindex);
    this.#map.un("singleclick", this.#handleMapClick);
    this.#map.un("pointermove", this.#handlePointerMove);
    this.#map.removeOverlay(this.#popup);
    this.#map.removeLayer(this.#highlightLayer);
  };
}

// The line strings of a LineString or MultiLineString, as coordinate arrays.
function lineStrings(geometry) {
  if (geometry.getType() === "MultiLineString") {
    return geometry.getLineStrings().map((l) => l.getCoordinates());
  }
  return geometry.getType() === "LineString" ? [geometry.getCoordinates()] : [];
}
