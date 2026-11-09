// Streets from light points: grouping and the figures the plugin pre-fills a
// calculation with. Pure functions, so they can be tested without a map.

import { NO_STREET } from "./utils.js";

// The light point properties the plugin reads, by their default names. A map
// whose layer uses other names maps them with the tool's `properties` option.
export const LIGHT_POINT_PROPERTIES = [
  "id",
  "streetId",
  "street",
  "area",
  "poleId",
  "existingLuminaire",
  "existingManufacturer",
  "existingWattage",
  "poleHeight",
  "armLength",
];

/**
 * Reads a light point's properties through the configured names: `get(name)`
 * returns the raw value of a property, `names` maps a default name to the
 * layer's own (e.g. `{ streetId: "GATU_ID" }`).
 */
export function readLightPoint(get, names = {}) {
  const point = {};
  LIGHT_POINT_PROPERTIES.forEach((p) => {
    point[p] = get(names[p] || p);
  });
  ["existingWattage", "poleHeight", "armLength"].forEach((p) => {
    point[p] = toNumber(point[p]);
  });
  return point;
}

const toNumber = (v) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const streetKey = (point) =>
  point.streetId == null || point.streetId === ""
    ? NO_STREET
    : String(point.streetId);

/**
 * Groups light points by street. Each entry is `{ point, lonLat }` plus
 * whatever the caller needs to keep (such as the map feature).
 */
export function groupByStreet(entries) {
  const groups = new Map();
  entries.forEach((e) => {
    const key = streetKey(e.point);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return groups;
}

/**
 * A street's figures from its light points. `distance(a, b)` returns metres
 * between two [lon, lat] positions.
 */
export function streetStats(entries, distance) {
  const points = entries.map((e) => e.point);
  const watts = points.map((p) => p.existingWattage).filter((w) => w > 0);
  const luminaires = new Map();
  points.forEach((p) => {
    const l = p.existingLuminaire;
    if (l) luminaires.set(l, (luminaires.get(l) || 0) + 1);
  });
  const typical = [...luminaires.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    count: points.length,
    avgWattage: watts.length
      ? watts.reduce((a, b) => a + b, 0) / watts.length
      : null,
    typicalLuminaire: typical ? typical[0] : null,
    spacing: medianNeighbourDistance(
      entries.map((e) => e.lonLat),
      distance
    ),
    poleHeight: median(points.map((p) => p.poleHeight)),
    armLength: median(points.map((p) => p.armLength)),
  };
}

// Fewer points than this give no useful idea of the spacing.
const MIN_POINTS_FOR_SPACING = 3;

/**
 * The median distance from each light point to its nearest neighbour: a
 * reasonable first guess at the pole spacing, which the user can correct. The
 * median keeps a few misplaced poles from moving it.
 */
export function medianNeighbourDistance(lonLats, distance) {
  if (lonLats.length < MIN_POINTS_FOR_SPACING) return null;
  const nearest = lonLats.map((a, i) => {
    let best = Infinity;
    lonLats.forEach((b, j) => {
      if (i !== j) best = Math.min(best, distance(a, b));
    });
    return best;
  });
  return median(nearest);
}

export function median(values) {
  const v = values
    .filter((x) => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}
