import { Box, Stack, Typography } from "@mui/material";
import PolarDiagram from "./PolarDiagram";
import { nf } from "../utils";

function Fact({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

/** The luminaire's light distribution from its LDT, with the key figures. */
function PhotometryPanel({ data, powerW }) {
  const flux = data.luminousFlux > 0 ? data.luminousFlux : null;
  const lor = data.lightOutputRatio > 0 ? data.lightOutputRatio : null;
  // LDT flux is lamp flux; the luminaire emits flux × LOR.
  const emitted = flux && lor ? (flux * lor) / (lor > 1 ? 100 : 1) : flux;
  const efficacy = emitted && powerW > 0 ? emitted / powerW : null;

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="flex-start"
      sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}
    >
      <PolarDiagram data={data} size={156} />
      <Stack spacing={1} sx={{ pt: 0.5, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Ljusfördelning
        </Typography>
        {emitted && <Fact label="Ljusflöde" value={`${nf(emitted)} lm`} />}
        {efficacy && <Fact label="Ljusutbyte" value={`${nf(efficacy)} lm/W`} />}
        {lor && (
          <Fact
            label="Verkningsgrad (LOR)"
            value={`${nf(lor > 1 ? lor : lor * 100)} %`}
          />
        )}
      </Stack>
    </Stack>
  );
}

export default PhotometryPanel;
