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
import { NO_STREET, STANDARD_ID } from "./utils";

// Colours follow the swelux palette; pass/fail match the plugin's result table.
const AMBER = "#F2B544";
const NAVY = "#10162A";
const PASS = "#2E9B66";
const FAIL = "#D2603A";

// A road sample counts as lit when a light point of the street is this close.
const LIT_DISTANCE_M = 35;
const SAMPLE_STEP_M = 5;

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

  constructor(settings) {
    this.#map = settings.map;
    this.#app = settings.app;
    this.#localObserver = settings.localObserver;
    this.#options = settings.options;

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
    this.#waitForLightPoints();
  }

  // Base of the organisation's map API. "{tenantId}" in apiBase, streetsUrl and
  // contextUrl is replaced by the organisation id: the tenantId option, or the
  // value of the cookie named by tenantIdCookie (set by a sign-in gateway that
  // lets the user pick an organisation).
  get apiBase() {
    return this.#resolve(
      this.#options.apiBase || "/api/v1/organisations/{tenantId}/map"
    );
  }

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

  // Hosted map only: which tenant's data is shown, and how much of it there is.
  #loadContext = async () => {
    if (!this.#options.contextUrl) return;
    try {
      const res = await fetch(this.#resolve(this.#options.contextUrl), {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      this.#context = await res.json();
      this.#localObserver.publish("swelux.context", this.#context);
    } catch (error) {
      console.warn("Swelux: could not load the map context", error);
    }
  };

  // The light point layer loads asynchronously (Hajk vector layer, GeoJSON) and
  // signals nothing when done. Poll its source until features arrive, then index
  // them by street; stop when the context says there is nothing to wait for.
  #waitForLightPoints = () => {
    const layer = this.#lightPointLayer();
    const source = layer?.getSource();
    if (source && source.getFeatures().length > 0) {
      this.#indexStreets(source.getFeatures());
      this.#fitToData(source.getFeatures());
      return;
    }
    if (this.#context?.lightPointCount === 0) return;
    setTimeout(this.#waitForLightPoints, 500);
  };

  // One map serves every tenant, so start where this tenant's light points are.
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

  #streetKey = (feature) => {
    const id = feature.get("streetId");
    return id == null || id === "" ? NO_STREET : String(id);
  };

  #indexStreets = (features) => {
    const groups = new Map();
    features.forEach((f) => {
      const key = this.#streetKey(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    });
    groups.forEach((points, key) => {
      this.#streets.set(key, {
        key,
        name: points[0].get("street") || "Okänd gata",
        area: points[0].get("area") || "",
        points,
        stats: this.#streetStats(points),
      });
    });
    this.#localObserver.publish("swelux.streetsReady", this.getStreets());
  };

  #streetStats = (points) => {
    const watts = points
      .map((p) => p.get("existingWattage"))
      .filter((w) => w > 0);
    const lums = new Map();
    points.forEach((p) => {
      const l = p.get("existingLuminaire");
      if (l) lums.set(l, (lums.get(l) || 0) + 1);
    });
    const typical = [...lums.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      count: points.length,
      avgWattage: watts.length
        ? watts.reduce((a, b) => a + b, 0) / watts.length
        : null,
      typicalLuminaire: typical ? typical[0] : null,
      spacing: this.#medianNeighbourDistance(points),
      poleHeight: median(points.map((p) => p.get("poleHeight"))),
      armLength: median(points.map((p) => p.get("armLength"))),
    };
  };

  // Median nearest-neighbour distance between the street's light points: a
  // reasonable first guess at pole spacing, which the user can correct.
  #medianNeighbourDistance = (points) => {
    if (points.length < 3) return null;
    const ll = points.map((p) => toLonLat(p.getGeometry().getCoordinates()));
    const nn = ll.map((a, i) => {
      let best = Infinity;
      ll.forEach((b, j) => {
        if (i !== j) best = Math.min(best, getDistance(a, b));
      });
      return best;
    });
    nn.sort((a, b) => a - b);
    return nn[Math.floor(nn.length / 2)];
  };

  #loadRoads = async () => {
    if (!this.#options.streetsUrl) return;
    try {
      const res = await fetch(this.#resolve(this.#options.streetsUrl), {
        credentials: "same-origin",
      });
      const geojson = await res.json();
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

  #pointInfo = (f) => ({
    id: f.get("id"),
    poleId: f.get("poleId"),
    existingLuminaire: f.get("existingLuminaire"),
    existingManufacturer: f.get("existingManufacturer"),
    existingWattage: f.get("existingWattage"),
  });

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
    // OSM roads often run well past the lit part (and same-named roads exist
    // elsewhere in the city), so only draw the stretches with light points along them.
    const pointCoords = street.points.map((p) =>
      p.getGeometry().getCoordinates()
    );
    const view = this.#map.getView();
    const unitsPerMetre =
      1 / getPointResolution(view.getProjection(), 1, pointCoords[0]);
    const roads = this.#roads
      .filter((r) => r.key === street.key)
      .flatMap((r) =>
        this.#litStretches(r.feature.getGeometry(), pointCoords, unitsPerMetre)
      )
      .map((coords) => new Feature(new LineString(coords)));
    roads.forEach((f) => f.set("kind", "road"));
    const points = street.points.map((p) => {
      const c = p.clone();
      c.set("kind", "point");
      return c;
    });
    this.#highlightSource.addFeatures([...roads, ...points]);
  };

  #litStretches = (geometry, pointCoords, unitsPerMetre) => {
    if (geometry.getType() === "MultiLineString") {
      return geometry
        .getLineStrings()
        .flatMap((line) =>
          this.#litStretches(line, pointCoords, unitsPerMetre)
        );
    }
    if (geometry.getType() !== "LineString") return [];
    const maxSq = (LIT_DISTANCE_M * unitsPerMetre) ** 2;
    const step = SAMPLE_STEP_M * unitsPerMetre;
    const isLit = (c) =>
      pointCoords.some((p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 <= maxSq);

    const coords = geometry.getCoordinates();
    const runs = [];
    let run = [];
    const visit = (c) => {
      if (isLit(c)) {
        run.push(c);
      } else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    };
    for (let i = 0; i < coords.length - 1; i++) {
      const [a, b] = [coords[i], coords[i + 1]];
      const n = Math.max(
        1,
        Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
      );
      for (let k = 0; k < n; k++) {
        visit([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
    }
    visit(coords[coords.length - 1]);
    if (run.length > 1) runs.push(run);
    return runs;
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

  // ---- swelux.ai map API (same origin; the gateway adds the user's token) ----

  #request = async (url, init = {}) => {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (res.status === 401) {
      throw new Error(
        "Din inloggning har gått ut. Ladda om sidan och logga in igen."
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The platform answers with RFC 9457 problem details.
      throw new Error(
        body.detail ||
          body.title ||
          body.error ||
          `Beräkningstjänsten svarade ${res.status}`
      );
    }
    return body;
  };

  #mapApi = (path, init) => this.#request(`${this.apiBase}${path}`, init);

  fetchLuminaires = () => this.#mapApi("/luminaires");

  // The EN 13201 lighting classes, with their requirements, from the platform.
  fetchLightingClasses = async () => {
    const standards = await this.#request(
      this.#options.standardsUrl || "/api/v1/standards"
    );
    const standard =
      standards.find((s) => s.standard.id === STANDARD_ID) || standards[0];
    return standard ? standard.lightingClasses : [];
  };

  // Dry road surfaces (CIE R-tables) to choose from; wet tables are not a
  // street's surface on their own.
  fetchRoadSurfaces = async () => {
    const surfaces = await this.#request(
      this.#options.roadSurfacesUrl || "/api/v1/road-surfaces"
    );
    return surfaces.filter((s) => s.condition !== "Wet");
  };

  // Luminaire ids are opaque strings (GUIDs); use them as given.
  #photometry = new Map();

  // What the engine reads from the luminaire's photometric file, cached per luminaire.
  fetchPhotometry = (luminaireId) => {
    const key = String(luminaireId);
    if (!this.#photometry.has(key)) {
      const req = this.#mapApi(
        `/luminaires/${encodeURIComponent(key)}/photometry`
      );
      req.catch(() => this.#photometry.delete(key));
      this.#photometry.set(key, req);
    }
    return this.#photometry.get(key);
  };

  // profile = { street, placement } in the platform's terms; every field is sent.
  fetchDetail = ({ street, placement }, luminaireId) =>
    this.#mapApi("/evaluations/detail", {
      method: "POST",
      body: JSON.stringify({ street, placement, luminaireId }),
    });

  ldtUrl = (luminaireId) =>
    `${this.apiBase}/luminaires/${encodeURIComponent(luminaireId)}/photometric-file`;

  evaluate = ({ street, placement }, luminaireIds = null) =>
    this.#mapApi("/evaluations", {
      method: "POST",
      body: JSON.stringify({ street, placement, luminaireIds }),
    });

  dispose = () => {
    this.#map.un("singleclick", this.#handleMapClick);
    this.#map.un("pointermove", this.#handlePointerMove);
    this.#map.removeOverlay(this.#popup);
    this.#map.removeLayer(this.#highlightLayer);
  };
}

function median(values) {
  const v = values
    .filter((x) => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}
