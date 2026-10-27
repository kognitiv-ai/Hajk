import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { getDistance } from "ol/sphere";
import { getPointResolution, toLonLat } from "ol/proj";
import LineString from "ol/geom/LineString";
import Feature from "ol/Feature";
import { boundingExtent, buffer } from "ol/extent";

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
 * talks to the swelux street-lighting API.
 */
export default class SweluxModel {
  #map;
  #app;
  #localObserver;
  #options;
  #streets = new Map(); // gatakey -> { key, name, points: Feature[], stats }
  #roads = []; // OSM road segments: { key, feature }
  #highlightSource = new VectorSource();
  #highlightLayer;
  #selected = null;
  #verdict = null; // null | "pass" | "fail"

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
    this.#map.on("singleclick", this.#handleMapClick);
    this.#loadRoads();
    this.#waitForLightPoints();
  }

  get apiBase() {
    return this.#options.apiBase || "/swelux-api";
  }

  getStreets = () =>
    [...this.#streets.values()]
      .filter((s) => s.key && s.key !== "UNASSIGNED")
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  getStreet = (key) => this.#streets.get(key) || null;

  // The light point layer loads asynchronously (Hajk vector layer, GeoJSON).
  // Poll its source until features arrive, then index them by street.
  #waitForLightPoints = () => {
    const layer = this.#lightPointLayer();
    const source = layer?.getSource();
    if (source && source.getFeatures().length > 0) {
      this.#indexStreets(source.getFeatures());
      return;
    }
    setTimeout(this.#waitForLightPoints, 500);
  };

  #lightPointLayer = () =>
    this.#map
      .getAllLayers()
      .find((l) => l.get("name") === this.#options.lightPointLayerId);

  #indexStreets = (features) => {
    const groups = new Map();
    features.forEach((f) => {
      const key = f.get("gatakey") || "UNASSIGNED";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    });
    groups.forEach((points, key) => {
      this.#streets.set(key, {
        key,
        name: points[0].get("gata") || "Okänd gata",
        area: points[0].get("omrade") || "",
        points,
        stats: this.#streetStats(points),
      });
    });
    this.#localObserver.publish("swelux.streetsReady", this.getStreets());
  };

  #streetStats = (points) => {
    const watts = points.map((p) => p.get("effekt_w")).filter((w) => w > 0);
    const lums = new Map();
    points.forEach((p) => {
      const l = p.get("armatur");
      if (l) lums.set(l, (lums.get(l) || 0) + 1);
    });
    const typical = [...lums.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      count: points.length,
      avgWattage: watts.length
        ? watts.reduce((a, b) => a + b, 0) / watts.length
        : null,
      typicalLuminaire: typical ? typical[0] : null,
      spacingM: this.#medianNeighbourDistance(points),
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
      const res = await fetch(this.#options.streetsUrl, {
        credentials: "same-origin",
      });
      const geojson = await res.json();
      const features = new GeoJSON().readFeatures(geojson, {
        dataProjection: "EPSG:4326",
        featureProjection: this.#map.getView().getProjection(),
      });
      this.#roads = features.map((f) => ({
        key: f.get("gatakey"),
        feature: f,
      }));
    } catch (error) {
      console.warn("Swelux: could not load street geometries", error);
    }
  };

  #handleMapClick = (e) => {
    const layer = this.#lightPointLayer();
    if (!layer || !layer.getVisible()) return;
    let hit = null;
    this.#map.forEachFeatureAtPixel(
      e.pixel,
      (f) => {
        hit = f;
        return true;
      },
      { layerFilter: (l) => l === layer, hitTolerance: 6 }
    );
    if (!hit) return;
    this.selectStreet(hit.get("gatakey") || "UNASSIGNED", hit);
    this.#app.globalObserver.publish("swelux.showWindow", {
      hideOtherPluginWindows: true,
      runCallback: true,
    });
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
      clicked: clickedFeature
        ? {
            id: clickedFeature.get("id"),
            stolpe: clickedFeature.get("stolpe"),
            armatur: clickedFeature.get("armatur"),
            effekt: clickedFeature.get("effekt_w"),
          }
        : null,
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

  // ---- swelux API (same origin; the gateway adds the user's token) ----

  #request = async (path, init = {}) => {
    const res = await fetch(`${this.apiBase}${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Din inloggning har gått ut. Ladda om sidan och logga in igen."
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Beräkningstjänsten svarade ${res.status}`);
    }
    return body;
  };

  fetchLuminaires = () => this.#request("/street-lighting/luminaires");

  evaluate = (profile, luminaireIds = null) =>
    this.#request("/street-lighting/evaluate", {
      method: "POST",
      body: JSON.stringify({ ...profile, luminaireIds }),
    });

  dispose = () => {
    this.#map.un("singleclick", this.#handleMapClick);
    this.#map.removeLayer(this.#highlightLayer);
  };
}
