import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { gridsFor, nf } from "../utils";

const FIELDS = 3; // the calculation field (one spacing) repeated three times
const PX_PER_M = 9;
const MARGIN_M = 3.5;
const SIDE_M = 2; // room for the outermost poles
// Sequential scale from dark to bright, readable as "more light".
const PALETTE = [
  "#1B2440",
  "#283a73",
  "#2f5d9b",
  "#2c86a8",
  "#3fae9a",
  "#8fcb6b",
  "#e6d75a",
  "#fff1a8",
];

// Smallest "nice" band width (1, 2, 2.5 or 5 × 10ⁿ) so all bands cover the range.
function niceStep(max, bands) {
  const raw = max / bands;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/**
 * The grids of one quantity as a lookup with bilinear interpolation. The
 * engine's GridDto has values[i][j] at (x[i], y[j]); several grids of the same
 * quantity on the same points (luminance per observer) are averaged.
 */
function buildField(grids) {
  const { x: xs, y: ys } = grids[0];
  const same = grids.filter(
    (g) => g.x.length === xs.length && g.y.length === ys.length
  );
  const at = (i, j) =>
    same.reduce((sum, g) => sum + (g.values[i]?.[j] ?? 0), 0) / same.length;
  const locate = (arr, v) => {
    if (arr.length === 1 || v <= arr[0]) return [0, 0, 0];
    if (v >= arr[arr.length - 1]) return [arr.length - 1, arr.length - 1, 0];
    let i = 0;
    while (arr[i + 1] < v) i++;
    return [i, i + 1, (v - arr[i]) / (arr[i + 1] - arr[i])];
  };
  const sample = (x, y) => {
    const [i0, i1, tx] = locate(xs, x);
    const [j0, j1, ty] = locate(ys, y);
    const a = at(i0, j0) * (1 - tx) + at(i1, j0) * tx;
    const b = at(i0, j1) * (1 - tx) + at(i1, j1) * tx;
    return a * (1 - ty) + b * ty;
  };
  let max = 0;
  xs.forEach((_, i) => ys.forEach((__, j) => (max = Math.max(max, at(i, j)))));
  return { sample, max };
}

/**
 * The road from above over three pole spacings, as the engine calculated it:
 * the areas across the road and the rows of poles from the design, the
 * calculation field coloured by luminance or illuminance in steps.
 */
function RoadPlan({ design, evaluation, quantity }) {
  const theme = useTheme();

  const model = React.useMemo(() => {
    const area = evaluation?.areas?.[0];
    const grids = gridsFor(area, quantity);
    const option = design?.options?.[0];
    if (!grids.length || !option) return null;
    const field = buildField(grids);
    const x0 = evaluation.field.startX;
    const fieldLen = evaluation.field.endX - x0;
    const x1 = x0 + FIELDS * fieldLen;
    const yRoad0 = 0;
    const yRoad1 = design.areas.reduce((w, a) => w + a.width, 0);

    // Every row repeats at its spacing, so the field tiles along the road.
    const valueAt = (x, y) => {
      const k = Math.floor((x - x0) / fieldLen);
      return field.sample(x - k * fieldLen, y);
    };

    const poles = [];
    option.rows.forEach((row) => {
      const pole = design.equipment.find((p) => p.id === row.poleId);
      if (!pole || !(row.spacing > 0)) return;
      const kMin = Math.ceil((x0 - 0.01 - row.firstPolePosition) / row.spacing);
      const kMax = Math.floor(
        (x1 + 0.01 - row.firstPolePosition) / row.spacing
      );
      for (let k = kMin; k <= kMax; k++) {
        const x = row.firstPolePosition + k * row.spacing;
        const y = row.lateralPosition;
        poles.push({
          x,
          y,
          heads: pole.arms.map((arm) => {
            const rad =
              ((arm.directionDegrees + row.rotationDegrees) * Math.PI) / 180;
            return {
              x: x + arm.outreach * Math.cos(rad),
              y: y + arm.outreach * Math.sin(rad),
            };
          }),
        });
      }
    });

    const ys = poles.flatMap((p) => [p.y, ...p.heads.map((h) => h.y)]);
    const step = niceStep(field.max, PALETTE.length);
    return {
      x0,
      x1,
      yMin: Math.min(yRoad0, ...ys) - MARGIN_M,
      yMax: Math.max(yRoad1, ...ys) + MARGIN_M,
      yRoad0,
      yRoad1,
      boundaries: design.areas
        .slice(0, -1)
        .reduce((acc, a) => [...acc, (acc.at(-1) ?? 0) + a.width], []),
      valueAt,
      poles,
      step,
      unit: grids[0].unit,
    };
  }, [design, evaluation, quantity]);

  // Raster the field once per input into a data URL, so it also survives printing.
  const image = React.useMemo(() => {
    if (!model) return null;
    const w = Math.round((model.x1 - model.x0) * PX_PER_M);
    const h = Math.round((model.yRoad1 - model.yRoad0) * PX_PER_M);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    const rgb = PALETTE.map((c) =>
      [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    );
    for (let py = 0; py < h; py++) {
      const y = model.yRoad1 - (py + 0.5) / PX_PER_M;
      for (let px = 0; px < w; px++) {
        const x = model.x0 + (px + 0.5) / PX_PER_M;
        const band = Math.min(
          PALETTE.length - 1,
          Math.floor(model.valueAt(x, y) / model.step)
        );
        const o = (py * w + px) * 4;
        [img.data[o], img.data[o + 1], img.data[o + 2]] = rgb[band];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }, [model]);

  if (!model) return null;

  const W = (model.x1 - model.x0 + 2 * SIDE_M) * PX_PER_M;
  const H = (model.yMax - model.yMin) * PX_PER_M;
  const sx = (x) => (x - model.x0 + SIDE_M) * PX_PER_M;
  const roadW = (model.x1 - model.x0) * PX_PER_M;
  const sy = (y) => (model.yMax - y) * PX_PER_M;
  const ink = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const unit = model.unit;
  // The first row's poles, for the spacing dimension.
  const firstRowY = model.poles[0]?.y;
  const first = model.poles
    .filter((p) => Math.abs(p.y - firstRowY) < 0.01)
    .sort((a, b) => a.x - b.x);

  return (
    <Box>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        width="100%"
        role="img"
        aria-label="Vägen ovanifrån med beräknad ljusfördelning"
      >
        <rect
          x={sx(model.x0)}
          y={sy(model.yRoad1)}
          width={roadW}
          height={(model.yRoad1 - model.yRoad0) * PX_PER_M}
          fill="#1B2440"
        />
        <image
          href={image}
          x={sx(model.x0)}
          y={sy(model.yRoad1)}
          width={roadW}
          height={(model.yRoad1 - model.yRoad0) * PX_PER_M}
          preserveAspectRatio="none"
        />
        <line
          x1={sx(model.x0)}
          x2={sx(model.x1)}
          y1={sy(model.yRoad0)}
          y2={sy(model.yRoad0)}
          stroke={ink}
          strokeWidth={1.5}
        />
        {model.boundaries.map((y) => (
          <line
            key={y}
            x1={sx(model.x0)}
            x2={sx(model.x1)}
            y1={sy(y)}
            y2={sy(y)}
            stroke={ink}
            strokeWidth={1}
            strokeDasharray="6 4"
          />
        ))}
        <line
          x1={sx(model.x0)}
          x2={sx(model.x1)}
          y1={sy(model.yRoad1)}
          y2={sy(model.yRoad1)}
          stroke={ink}
          strokeWidth={1.5}
        />
        {model.poles.map((p, i) => (
          <g key={i}>
            {p.heads.map((h, j) => (
              <g key={j}>
                <line
                  x1={sx(p.x)}
                  y1={sy(p.y)}
                  x2={sx(h.x)}
                  y2={sy(h.y)}
                  stroke={ink}
                  strokeWidth={2}
                />
                <rect
                  x={sx(h.x) - 6}
                  y={sy(h.y) - 3}
                  width={12}
                  height={6}
                  rx={2}
                  fill="#F2B544"
                  stroke={ink}
                  strokeWidth={1}
                />
              </g>
            ))}
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={4}
              fill={theme.palette.background.paper}
              stroke={ink}
              strokeWidth={2}
            />
          </g>
        ))}
        {first.length >= 2 && (
          <g fontSize="11" fill={muted}>
            <line
              x1={sx(first[0].x)}
              x2={sx(first[1].x)}
              y1={H + 6}
              y2={H + 6}
              stroke={muted}
            />
            <line
              x1={sx(first[0].x)}
              x2={sx(first[0].x)}
              y1={H + 2}
              y2={H + 10}
              stroke={muted}
            />
            <line
              x1={sx(first[1].x)}
              x2={sx(first[1].x)}
              y1={H + 2}
              y2={H + 10}
              stroke={muted}
            />
            <text
              x={(sx(first[0].x) + sx(first[1].x)) / 2}
              y={H + 17}
              textAnchor="middle"
            >
              {nf(first[1].x - first[0].x, 0)} m
            </text>
          </g>
        )}
      </svg>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: "none" }}
        >
          {quantity === "Luminance" ? "Luminans" : "Belysningsstyrka"}
        </Typography>
        <Box sx={{ flex: 1, display: "flex", minWidth: 0 }}>
          {PALETTE.map((c, i) => (
            <Box key={c} sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ height: 10, bgcolor: c }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 10 }}
                noWrap
                component="div"
              >
                {i % 2 === 0 ? nf(i * model.step, model.step < 1 ? 2 : 0) : ""}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: "none" }}
        >
          {unit}
        </Typography>
      </Stack>
    </Box>
  );
}

export default RoadPlan;
