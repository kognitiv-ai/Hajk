// Shared helpers. The street, placement and results are the swelux.ai
// platform's own shapes (see the platform's map API); only labels are Swedish.

export const STANDARD_ID = "en-13201:2015";

// Light points that belong to no street (streetId null) are grouped here.
export const NO_STREET = "UNASSIGNED";

export const ARRANGEMENTS = [
  { value: "OneSide", label: "Enkelsidig" },
  { value: "Staggered", label: "Växelvis" },
  { value: "Opposite", label: "Motstående" },
  { value: "Central", label: "Mittförlagd" },
];

// Short Swedish labels for the engine's metric ids; anything else shows the
// engine's own (English) name.
const METRIC_LABELS = {
  "average-luminance": "Luminans",
  "overall-luminance-uniformity": "Total jämnhet",
  "wet-overall-luminance-uniformity": "Total jämnhet, våt väg",
  "longitudinal-luminance-uniformity": "Längsjämnhet",
  "threshold-increment": "Bländning",
  "edge-illuminance-ratio": "Kantbelysning",
  "average-illuminance": "Belysningsstyrka",
  "minimum-illuminance": "Lägsta belysningsstyrka",
  "overall-illuminance-uniformity": "Total jämnhet",
};

export const metricLabel = (metric) =>
  METRIC_LABELS[metric.id || metric.metricId] || metric.name;

// Decimals by unit: ratios and luminance need two, the rest one.
export const metricDecimals = (metric) =>
  metric.unit === "lx" || metric.unit === "%" ? 1 : 2;

export const formatMetric = (metric, value = metric.value) =>
  `${nf(value, metricDecimals(metric))}${metric.unit ? ` ${metric.unit}` : ""}`;

export function requirementText(metric) {
  const r = metric.requirement;
  if (!r) return "";
  const d = metricDecimals(metric);
  if (r.kind === "AtMost") return `≤ ${nf(r.limit, d)}`;
  if (r.kind === "Between") return `${nf(r.limit, d)}–${nf(r.upperLimit, d)}`;
  return `≥ ${nf(r.limit, d)}`;
}

export const isCompliant = (status) => status === "Compliant";

export const statusText = (status, lightingClass) =>
  status === "Compliant"
    ? `Uppfyller ${lightingClass}`
    : status === "NonCompliant"
      ? `Uppfyller inte ${lightingClass}`
      : `Ej bedömd mot ${lightingClass}`;

export const nf = (v, d = 0) =>
  v == null || Number.isNaN(v)
    ? "–"
    : Number(v).toLocaleString("sv-SE", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

export const lumLabel = (l) =>
  l
    ? `${l.manufacturer || "Okänd"} · ${l.name}${l.systemPower ? ` · ${nf(l.systemPower, 1)} W` : ""}`
    : "";

export const arrangementLabel = (value) =>
  ARRANGEMENTS.find((a) => a.value === value)?.label || value;

const within = (v, min, max) => v != null && v >= min && v <= max;

/**
 * The street and placement to calculate: the configured defaults (in the
 * platform's terms), with spacing, light centre height and outreach taken from
 * the street's light points where the register has plausible values. The
 * default road surface may be given by name ("CIE R3") and is resolved against
 * the platform's road surfaces.
 */
export function profileFor(street, defaults, surfaces) {
  const { roadSurface, ...streetDefaults } = defaults.street || {};
  const surfaceId =
    streetDefaults.roadSurfaceId ||
    surfaces.find((s) => s.name === roadSurface)?.id ||
    surfaces[0]?.id ||
    null;
  const placement = { ...defaults.placement };
  const stats = street?.stats;
  if (within(stats?.spacing, 12, 80))
    placement.spacing = Math.round(stats.spacing);
  if (within(stats?.poleHeight, 2, 30))
    placement.lightCentreHeight = stats.poleHeight;
  if (within(stats?.armLength, 0, 10)) placement.outreach = stats.armLength;
  return {
    street: {
      averageLuminanceCoefficient: null,
      ...streetDefaults,
      roadSurfaceId: surfaceId,
    },
    placement,
  };
}

/**
 * Energy against today's register: the new luminaire's power per kilometre
 * against today's wattage at the same number of luminaires per kilometre, and
 * a year's consumption for the street's light points.
 */
export function energyFor(result, street, hours) {
  const existingW = street.stats.avgWattage;
  const perKm = result.powerPerKilometre;
  const power = result.luminaire.systemPower;
  if (!existingW || !perKm || !power) return null;
  const luminairesPerKm = perKm / power;
  const existingPerKm = existingW * luminairesPerKm;
  const savedPct = (1 - perKm / existingPerKm) * 100;
  const savedKwh = ((existingW - power) * street.stats.count * hours) / 1000;
  return { existingW, existingPerKm, perKm, savedPct, savedKwh };
}

// The road area's grids of one quantity: the fine isoline grids when the
// engine sent them (edge to edge), else the standard's calculation points.
// Wet-road luminance is left out of the dry picture.
export function gridsFor(area, quantity) {
  const pick = (list) =>
    (list || []).filter(
      (g) => g.quantity === quantity && !g.id.startsWith("wet-")
    );
  const fine = pick(area?.isolineGrids);
  return fine.length ? fine : pick(area?.grids);
}
