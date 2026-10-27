export const CLASSES = [
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "C3",
  "C4",
  "C5",
  "P2",
  "P3",
  "P4",
];
export const SURFACES = ["R1", "R2", "R3", "R4", "C1", "C2"];
export const ARRANGEMENTS = [
  { value: "single", label: "Enkelsidig" },
  { value: "staggered", label: "Växelvis" },
  { value: "opposite", label: "Motstående" },
  { value: "central", label: "Mittförlagd" },
];

export const nf = (v, d = 0) =>
  v == null || Number.isNaN(v)
    ? "–"
    : Number(v).toLocaleString("sv-SE", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

export const lumLabel = (l) =>
  l
    ? `${l.manufacturer || "Okänd"} · ${l.name}${l.wattage ? ` · ${nf(l.wattage)} W` : ""}`
    : "";

export const arrangementLabel = (value) =>
  ARRANGEMENTS.find((a) => a.value === value)?.label || value;

export function profileFor(street, defaults) {
  const spacing = street?.stats.spacingM;
  return {
    ...defaults,
    spacingM:
      spacing && spacing >= 12 && spacing <= 80
        ? Math.round(spacing)
        : defaults.spacingM,
  };
}

// Pass/fail rows for the class family: luminance for M, illuminance for C/P.
export function checksFor(result, target) {
  if (!result || !target) return [];
  const rows =
    target.family === "M"
      ? [
          {
            label: "Luminans",
            unit: "cd/m²",
            value: result.lavg,
            req: target.lavgMin,
            op: "≥",
            d: 2,
          },
          {
            label: "Total jämnhet U0",
            unit: "",
            value: result.u0,
            req: target.u0Min,
            op: "≥",
            d: 2,
          },
          {
            label: "Längsjämnhet Ul",
            unit: "",
            value: result.ul,
            req: target.ulMin,
            op: "≥",
            d: 2,
          },
          {
            label: "Bländning TI",
            unit: "%",
            value: result.ti,
            req: target.tiMax,
            op: "≤",
            d: 1,
          },
        ]
      : [
          {
            label: "Belysningsstyrka",
            unit: "lx",
            value: result.eavg,
            req: target.eavgMin,
            op: "≥",
            d: 1,
          },
          {
            label: "Total jämnhet U0",
            unit: "",
            value: result.u0,
            req: target.u0Min,
            op: "≥",
            d: 2,
          },
        ];
  return rows
    .filter((c) => c.req != null && !(c.op === "≥" && c.req === 0))
    .map((c) => ({
      ...c,
      ok: c.op === "≥" ? c.value >= c.req : c.value <= c.req,
    }));
}
