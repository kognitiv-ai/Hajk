import React from "react";
import {
  Alert,
  Box,
  Collapse,
  Link,
  List,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import { formatMetric, isCompliant, metricLabel, nf } from "../utils";

/**
 * Whole-catalogue result in the platform's order (compliant first, then by
 * power per kilometre): the best compliant options, or the nearest misses, and
 * the luminaires the engine could not calculate.
 */
function RankingList({ ranking, selectedId, onSelect, luminaires }) {
  const [showSkipped, setShowSkipped] = React.useState(false);
  const { results, skipped = [], lightingClass } = ranking;
  const compliantCount = results.filter((r) => isCompliant(r.status)).length;
  // The catalogue holds some duplicate entries (same product, same photometry);
  // show each product once.
  const seen = new Set();
  const unique = results.filter((r) => {
    const l = r.luminaire;
    const key = `${l.manufacturer}|${l.name}|${l.systemPower}|${r.metrics[0]?.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rows = compliantCount
    ? unique.filter((r) => isCompliant(r.status)).slice(0, 10)
    : unique.slice(0, 5);
  const nameOf = (id) => {
    const l = luminaires.find((x) => x.id === id);
    return l ? `${l.manufacturer} · ${l.name}` : id;
  };

  return (
    <Box>
      <Typography variant="subtitle2">
        {compliantCount
          ? `Bästa alternativen · ${nf(compliantCount)} av ${nf(results.length)} klarar ${lightingClass}`
          : `Ingen av ${nf(results.length)} armaturer klarar ${lightingClass}`}
      </Typography>
      {skipped.length > 0 && (
        <Typography variant="caption" color="text.secondary" component="p">
          {nf(skipped.length)} armaturer kunde inte beräknas.{" "}
          <Link
            component="button"
            variant="caption"
            color="inherit"
            onClick={() => setShowSkipped((v) => !v)}
            sx={{ verticalAlign: "baseline" }}
          >
            {showSkipped ? "Dölj" : "Visa varför"}
          </Link>
        </Typography>
      )}
      <Collapse in={showSkipped} unmountOnExit>
        <Box
          component="ul"
          sx={{ m: 0, mt: 0.5, pl: 2, maxHeight: 140, overflowY: "auto" }}
        >
          {skipped.map((s) => (
            <Typography
              key={s.luminaireId}
              component="li"
              variant="caption"
              color="text.secondary"
            >
              {nameOf(s.luminaireId)}: {s.reason}
            </Typography>
          ))}
        </Box>
      </Collapse>
      {compliantCount === 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Prova kortare stolpavstånd eller högre ljuspunkt. Närmast att klara
          kraven:
        </Alert>
      )}

      <List
        dense
        disablePadding
        sx={{ mt: 1, maxHeight: 300, overflowY: "auto" }}
      >
        {rows.map((r, i) => (
          <ListItemButton
            key={r.luminaire.id}
            selected={selectedId === r.luminaire.id}
            onClick={() => onSelect(r.luminaire.id)}
            sx={{
              borderRadius: 1,
              alignItems: "flex-start",
              gap: 1.25,
              py: 0.75,
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                flex: "none",
                mt: 0.25,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 600,
                bgcolor:
                  i === 0 && isCompliant(r.status)
                    ? "secondary.main"
                    : "action.selected",
                color:
                  i === 0 && isCompliant(r.status)
                    ? "secondary.contrastText"
                    : "text.primary",
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap title={r.luminaire.name}>
                {r.luminaire.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
              >
                {r.luminaire.manufacturer}
                {isCompliant(r.status) ? "" : " · klarar ej"}
              </Typography>
            </Box>
            <Stack alignItems="flex-end" sx={{ flex: "none" }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {r.powerPerKilometre != null
                  ? `${nf(r.powerPerKilometre / 1000, 2)} kW/km`
                  : `${nf(r.luminaire.systemPower, 1)} W`}
              </Typography>
              {r.metrics[0] && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  title={metricLabel(r.metrics[0])}
                >
                  {r.metrics[0].symbol} {formatMetric(r.metrics[0])}
                </Typography>
              )}
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

export default RankingList;
