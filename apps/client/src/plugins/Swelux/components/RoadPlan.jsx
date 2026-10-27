import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { nf } from "../utils";

const FIELDS = 3; // three pole spacings → four poles on a one-sided road
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

// Regular grid of calculation points → lookup with bilinear interpolation.
function buildField(grid, column) {
  const xs = [...new Set(grid.map((p) => p[0]))].sort((a, b) => a - b);
  const ys = [...new Set(grid.map((p) => p[1]))].sort((a, b) => a - b);
  const index = new Map(grid.map((p) => [`${p[0]}|${p[1]}`, p[column]]));
  const at = (i, j) => index.get(`${xs[i]}|${ys[j]}`) ?? 0;
  const locate = (arr, v) => {
    if (v <= arr[0]) return [0, 0, 0];
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
  return { sample, max: Math.max(...grid.map((p) => p[column])) };
}

/**
 * The road from above over three pole spacings: the EN 13201-3 calculation
 * field repeated along the road, coloured by luminance or illuminance in steps.
 */
function RoadPlan({ detail, quantity, spacing, arrangement }) {
  const theme = useTheme();
  const { road, poles, grid } = detail;
  const column = quantity === "E" ? 2 : 3;

  const model = React.useMemo(() => {
    if (!road || !grid?.length) return null;
    const calc = road.calc;
    const field = buildField(grid, column);
    const fieldLen = calc.endX - calc.startX;
    const x0 = calc.startX;
    const x1 = x0 + FIELDS * fieldLen;
    const yRoad0 = Math.min(road.overall.startY, road.overall.endY);
    const yRoad1 = Math.max(road.overall.startY, road.overall.endY);
    const poleYs = poles.flatMap((p) => [p.y, ...p.heads.map((h) => h.y)]);
    const yMin = Math.min(yRoad0, ...poleYs) - MARGIN_M;
    const yMax = Math.max(yRoad1, ...poleYs) + MARGIN_M;
    const staggered = arrangement === "staggered";
    const mid = (yRoad0 + yRoad1) / 2;

    const valueAt = (x, y) => {
      const k = Math.floor((x - x0) / fieldLen);
      const lx = x0 + (x - x0 - k * fieldLen);
      const ly = staggered && k % 2 !== 0 ? 2 * mid - y : y;
      return field.sample(lx, ly);
    };

    // Poles repeat with the spacing (twice the spacing for staggered rows).
    const period = (staggered ? 2 : 1) * spacing;
    const shown = [];
    poles.forEach((p) => {
      for (let k = -FIELDS - 2; k <= FIELDS + 2; k++) {
        const dx = k * period;
        const px = p.x + dx;
        if (px < x0 - 0.01 || px > x1 + 0.01) continue;
        if (
          shown.some(
            (s) => Math.abs(s.x - px) < 0.01 && Math.abs(s.y - p.y) < 0.01
          )
        )
          continue;
        shown.push({
          x: px,
          y: p.y,
          heads: p.heads.map((h) => ({ x: h.x + dx, y: h.y })),
        });
      }
    });

    const step = niceStep(field.max, PALETTE.length);
    return {
      x0,
      x1,
      yMin,
      yMax,
      yRoad0,
      yRoad1,
      valueAt,
      poles: shown,
      step,
    };
  }, [road, poles, grid, column, spacing, arrangement]);

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
  const unit = quantity === "E" ? "lx" : "cd/m²";
  const first = model.poles.slice().sort((a, b) => a.x - b.x);

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
          {quantity === "E" ? "Belysningsstyrka" : "Luminans"}
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
