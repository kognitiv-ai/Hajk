import React from "react";
import { Alert, Stack, Typography } from "@mui/material";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";

const LAYER_PROBLEMS = {
  missing: {
    title: "Lagret med ljuspunkter saknas",
    text: "Verktyget hittar inte lagret som anges i lightPointLayerId. Kontrollera kartans inställningar.",
  },
  notVector: {
    title: "Ljuspunkterna är en bild",
    text: "Lagret med ljuspunkter är ett bildlager (WMS). Verktyget behöver ljuspunkterna som objekt, till exempel som WFS eller GeoJSON.",
  },
};

/** What the window shows before a street is selected. */
function MapNotice({ layerProblem, context }) {
  if (layerProblem) {
    const p = LAYER_PROBLEMS[layerProblem];
    return (
      <Alert severity="warning">
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {p.title}
        </Typography>
        <Typography variant="body2">{p.text}</Typography>
      </Alert>
    );
  }
  if (context?.lightPointCount === 0) {
    return (
      <Alert severity="info">
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Ingen kartdata för {context.name} ännu
        </Typography>
        <Typography variant="body2">
          Organisationens ljuspunkter har inte lagts in i swelux.ai ännu.
        </Typography>
      </Alert>
    );
  }
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 3, textAlign: "center" }}>
      <TouchAppOutlinedIcon color="action" sx={{ fontSize: 40 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Klicka på en ljuspunkt i kartan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        Hela gatan väljs och kan beräknas enligt EN 13201 mot alla armaturer i
        katalogen, eller en du väljer själv.
      </Typography>
    </Stack>
  );
}

export default MapNotice;
