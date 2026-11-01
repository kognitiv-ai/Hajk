import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { alpha } from "@mui/material/styles";
import PhotometryPanel from "./PhotometryPanel";
import MetricTable, { StatusIcon } from "./MetricTable";
import { energyFor, isCompliant, nf, statusText } from "../utils";

const TONES = { Compliant: "success", NonCompliant: "error" };

/** Result for one luminaire: the engine's verdict, its metrics and energy. */
function VerdictCard({
  result,
  lightingClass,
  street,
  hours,
  photometry,
  onDetails,
}) {
  const { luminaire } = result;
  const tone = TONES[result.status] || "warning";
  const energy = energyFor(result, street, hours);

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
        <Box sx={{ mt: 0.25 }}>
          <StatusIcon status={result.status} size={24} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {statusText(result.status, lightingClass)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            title={`${luminaire.manufacturer} · ${luminaire.name}`}
          >
            {luminaire.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {luminaire.manufacturer}
            {luminaire.systemPower
              ? ` · ${nf(luminaire.systemPower, 1)} W`
              : ""}
          </Typography>
        </Box>
        {onDetails && (
          <Button
            size="small"
            color="inherit"
            startIcon={<OpenInFullIcon sx={{ fontSize: 16 }} />}
            onClick={onDetails}
            sx={{ flex: "none", textTransform: "none" }}
          >
            Detaljer
          </Button>
        )}
      </Stack>

      {photometry && <PhotometryPanel data={photometry} />}

      <Box sx={{ px: 1.75, pt: 0.5, pb: 1 }}>
        <MetricTable metrics={result.metrics} />
      </Box>

      {isCompliant(result.status) && energy && (
        <Box sx={{ px: 1.75, py: 1.25, borderTop: 1, borderColor: "divider" }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
              {energy.savedPct > 0 ? "−" : "+"}
              {nf(Math.abs(energy.savedPct))} %
            </Typography>
            <Typography variant="body2" color="text.secondary">
              effekt mot idag ({nf(energy.existingW)} W per armatur)
            </Typography>
          </Stack>
          <Typography variant="body2">
            {nf(energy.perKm / 1000, 2)} kW/km mot{" "}
            {nf(energy.existingPerKm / 1000, 2)} kW/km idag. Cirka{" "}
            {nf(Math.abs(energy.savedKwh), 0)} kWh{" "}
            {energy.savedKwh > 0 ? "lägre" : "högre"} förbrukning per år för
            gatans {nf(street.stats.count)} ljuspunkter.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Lampeffekt i ert register mot armaturens systemeffekt, {nf(hours)}{" "}
            h/år. Äldre armaturer drar oftast mer i väggen.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default VerdictCard;
