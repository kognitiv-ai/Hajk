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

/** What the engine reads from the luminaire's photometric file. */
function PhotometryPanel({ data }) {
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
        {data.luminousFlux > 0 && (
          <Fact label="Ljusflöde" value={`${nf(data.luminousFlux)} lm`} />
        )}
        {data.efficacy > 0 && (
          <Fact label="Ljusutbyte" value={`${nf(data.efficacy)} lm/W`} />
        )}
        {data.maximumIntensity > 0 && (
          <Fact
            label="Största ljusstyrka"
            value={`${nf(data.maximumIntensity)} cd`}
          />
        )}
      </Stack>
    </Stack>
  );
}

export default PhotometryPanel;
