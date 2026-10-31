import { useTheme } from "@mui/material/styles";
import { Box, Stack, Typography } from "@mui/material";

const MAX_GAMMA = 105;
const TICKS = [0, 30, 60, 90];

function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const mul =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return mul * mag;
}

// The engine's curve in the C-plane closest to `target` (0 or 90 degrees).
function curve(curves, target) {
  let best = null;
  curves.forEach((c) => {
    const diff = Math.abs((((c.cPlaneDegrees - target) % 180) + 180) % 180);
    const d = Math.min(diff, 180 - diff);
    if (!best || d < best.d) best = { c, d };
  });
  return best?.c || null;
}

/**
 * Luminous intensity distribution in cd/klm, as in a datasheet: the engine's
 * polar curves in C0–C180 and C90–C270, nadir pointing down. Each half is its
 * own plane, so asymmetric road optics show their real shape.
 */
function PolarDiagram({ data, size = 168 }) {
  const theme = useTheme();
  const curves = data?.polarCurves || [];
  const along = curve(curves, 0);
  const across = curve(curves, 90);
  if (!along) return null;

  const perKlm = data.luminousFlux > 0 ? data.luminousFlux / 1000 : 1;
  const halves = (c) =>
    c
      ? {
          gammas: c.gammaDegrees,
          right: c.candela.map((v) => Math.max(0, v ?? 0) / perKlm),
          left: c.oppositeCandela.map((v) => Math.max(0, v ?? 0) / perKlm),
        }
      : null;
  const c0 = halves(along);
  const c90 = halves(across && across !== along ? across : null);
  const max = niceCeil(
    Math.max(
      1,
      ...c0.right,
      ...c0.left,
      ...(c90 ? [...c90.right, ...c90.left] : [])
    )
  );

  const pad = 14;
  const r = (size - 2 * pad) / (2 * Math.sin((MAX_GAMMA * Math.PI) / 180));
  const cx = size / 2;
  const cy = pad + r * Math.max(0, -Math.cos((MAX_GAMMA * Math.PI) / 180)) + 2;
  const height = cy + r + pad;

  const point = (value, gamma, side) => {
    const rad = (gamma * Math.PI) / 180;
    const len = (value / max) * r;
    return [cx + side * len * Math.sin(rad), cy + len * Math.cos(rad)];
  };
  const path = ({ gammas, right, left }) => {
    const pts = [];
    for (let i = gammas.length - 1; i >= 0; i--)
      if (gammas[i] <= MAX_GAMMA) pts.push(point(left[i], gammas[i], -1));
    for (let i = 0; i < gammas.length; i++)
      if (gammas[i] <= MAX_GAMMA) pts.push(point(right[i], gammas[i], 1));
    return `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
  };

  const grid = theme.palette.divider;
  const muted = theme.palette.text.secondary;
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;

  return (
    <Box>
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        role="img"
        aria-label="Ljusfördelningskurva C0–C180 och C90–C270"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <path
            key={f}
            d={`M${cx - f * r} ${cy} A${f * r} ${f * r} 0 0 0 ${cx + f * r} ${cy}`}
            fill="none"
            stroke={grid}
            strokeDasharray={f === 1 ? undefined : "2 3"}
          />
        ))}
        {TICKS.map((g) =>
          [-1, 1].map((side) => {
            const [x, y] = point(max, g, side);
            return (
              <line
                key={`${g}${side}`}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={grid}
              />
            );
          })
        )}
        {c90 && (
          <path
            d={path(c90)}
            fill={secondary}
            fillOpacity={0.18}
            stroke={secondary}
            strokeWidth={1.75}
            strokeDasharray="4 2"
          />
        )}
        <path
          d={path(c0)}
          fill={primary}
          fillOpacity={0.12}
          stroke={primary}
          strokeWidth={1.75}
        />
        <text x={cx + 3} y={cy + r - 3} fontSize="9" fill={muted}>
          {max}
        </text>
        <text x={cx + r} y={cy - 3} fontSize="9" fill={muted} textAnchor="end">
          90°
        </text>
      </svg>
      <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }}>
        <Legend color={primary} label="C0–C180" />
        {c90 && <Legend color={secondary} label="C90–C270" dashed />}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        cd/klm
      </Typography>
    </Box>
  );
}

function Legend({ color, label, dashed }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box
        sx={{
          width: 14,
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export default PolarDiagram;
