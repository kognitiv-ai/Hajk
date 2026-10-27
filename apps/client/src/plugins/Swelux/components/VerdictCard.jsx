import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { checksFor, nf } from "../utils";

/** Result for one luminaire: verdict, requirement checks and energy. */
function VerdictCard({ result, evaluation, street, hours }) {
  const pass = result.compliant;
  const checks = checksFor(result, evaluation.target);
  const tone = pass ? "success" : "error";

  const existingW = street.stats.avgWattage;
  const savedKwh = existingW
    ? ((existingW - result.powerW) * street.stats.count * hours) / 1000
    : null;
  const savedPct = existingW ? (1 - result.powerW / existingW) * 100 : null;

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        overflow: "hidden",
        borderColor: alpha(theme.palette[tone].main, 0.5),
      })}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="flex-start"
        sx={(theme) => ({
          px: 1.75,
          py: 1.25,
          bgcolor: alpha(theme.palette[tone].main, 0.1),
        })}
      >
        {pass ? (
          <CheckCircleIcon color="success" sx={{ mt: 0.25 }} />
        ) : (
          <CancelIcon color="error" sx={{ mt: 0.25 }} />
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {pass ? "Uppfyller" : "Uppfyller inte"} {evaluation.requiredClass}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            title={`${result.manufacturer} · ${result.name}`}
          >
            {result.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {result.manufacturer} · {nf(result.powerW, 1)} W
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ px: 1.75, pt: 0.5, pb: 1 }}>
        {checks.map((c) => (
          <Stack
            key={c.label}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              py: 0.6,
              borderBottom: 1,
              borderColor: "divider",
              "&:last-of-type": { borderBottom: 0 },
            }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {c.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {nf(c.value, c.d)}
              {c.unit && ` ${c.unit}`}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                width: 64,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {c.op} {nf(c.req, c.d)}
            </Typography>
            {c.ok ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
            ) : (
              <CancelIcon color="error" sx={{ fontSize: 18 }} />
            )}
          </Stack>
        ))}
      </Box>

      {pass && savedKwh != null && (
        <Box sx={{ px: 1.75, py: 1.25, borderTop: 1, borderColor: "divider" }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
              {savedPct > 0 ? "−" : "+"}
              {nf(Math.abs(savedPct))} %
            </Typography>
            <Typography variant="body2" color="text.secondary">
              effekt mot idag ({nf(existingW)} W)
            </Typography>
          </Stack>
          <Typography variant="body2">
            Cirka {nf(Math.abs(savedKwh), 0)} kWh{" "}
            {savedKwh > 0 ? "lägre" : "högre"} förbrukning per år för gatan.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Lampeffekt i ert register, {nf(hours)} h/år. Äldre armaturer drar
            oftast mer i väggen.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default VerdictCard;
