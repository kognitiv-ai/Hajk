import {
  Alert,
  Box,
  List,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import { nf } from "../utils";

/** Whole-catalogue result: the best compliant options, or nearest misses. */
function RankingList({ ranking, selectedId, onSelect }) {
  const { compliantCount, calculated, requiredClass, target } = ranking;
  const rows = ranking.results.slice(
    0,
    compliantCount ? Math.min(10, compliantCount) : 5
  );

  return (
    <Box>
      <Typography variant="subtitle2">
        {compliantCount
          ? `Bästa alternativen · ${nf(compliantCount)} av ${nf(calculated)} klarar ${requiredClass}`
          : `Ingen av ${nf(calculated)} armaturer klarar ${requiredClass}`}
      </Typography>
      {ranking.skippedInvalidPower > 0 && (
        <Typography variant="caption" color="text.secondary" component="p">
          {nf(ranking.skippedInvalidPower)} armaturer utan giltig effekt i
          ljusdatan hoppades över.
        </Typography>
      )}
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
            key={r.luminaireId}
            selected={selectedId === r.luminaireId}
            onClick={() => onSelect(r.luminaireId)}
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
                  i === 0 && r.compliant ? "secondary.main" : "action.selected",
                color:
                  i === 0 && r.compliant
                    ? "secondary.contrastText"
                    : "text.primary",
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap title={r.name}>
                {r.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
              >
                {r.manufacturer}
                {r.compliant ? "" : " · klarar ej"}
              </Typography>
            </Box>
            <Stack alignItems="flex-end" sx={{ flex: "none" }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {nf(r.powerW, 1)} W
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {target?.family === "M"
                  ? `${nf(r.lavg, 2)} cd/m²`
                  : `${nf(r.eavg, 1)} lx`}
              </Typography>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

export default RankingList;
