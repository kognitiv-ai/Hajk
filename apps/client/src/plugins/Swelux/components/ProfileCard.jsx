import React from "react";
import {
  Box,
  Button,
  Collapse,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import {
  ARRANGEMENTS,
  CLASSES,
  SURFACES,
  arrangementLabel,
  nf,
} from "../utils";

function Field({ children, ...props }) {
  return (
    <Grid size={6}>
      <TextField size="small" fullWidth {...props}>
        {children}
      </TextField>
    </Grid>
  );
}

/**
 * Road profile as a one-line summary; the full form opens on demand so the
 * actions stay above the fold.
 */
function ProfileCard({ profile, onChange }) {
  const [open, setOpen] = React.useState(false);

  const set =
    (key, numeric = true) =>
    (e) =>
      onChange(key, numeric ? Number(e.target.value) : e.target.value);

  const summary = [
    profile.requiredClass,
    `${nf(profile.roadWidthM, 1).replace(",0", "")} m väg`,
    `${nf(profile.spacingM)} m c/c`,
    `${nf(profile.poleHeightM, 1).replace(",0", "")} m höjd`,
    arrangementLabel(profile.arrangement).toLowerCase(),
    profile.surfaceClass,
  ].join(" · ");

  return (
    <Paper variant="outlined" sx={{ px: 1.75, py: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Vägprofil
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {summary}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Klar" : "Ändra"}
        </Button>
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
          <Field
            label="Belysningsklass"
            value={profile.requiredClass}
            onChange={set("requiredClass", false)}
            select
          >
            {CLASSES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Field>
          <Field
            label="Vägbredd (m)"
            value={profile.roadWidthM}
            onChange={set("roadWidthM")}
            type="number"
          />
          <Field
            label="Stolpavstånd (m)"
            value={profile.spacingM}
            onChange={set("spacingM")}
            type="number"
          />
          <Field
            label="Ljuspunktshöjd (m)"
            value={profile.poleHeightM}
            onChange={set("poleHeightM")}
            type="number"
          />
          <Field
            label="Uppställning"
            value={profile.arrangement}
            onChange={set("arrangement", false)}
            select
          >
            {ARRANGEMENTS.map((a) => (
              <MenuItem key={a.value} value={a.value}>
                {a.label}
              </MenuItem>
            ))}
          </Field>
          <Field
            label="Beläggning"
            value={profile.surfaceClass}
            onChange={set("surfaceClass", false)}
            select
          >
            {SURFACES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Field>
        </Grid>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 1.25, mb: 0.5 }}
        >
          Stolpavståndet är uppskattat från era ljuspunkter – kontrollera det om
          stolparna står på båda sidor. Klass och vägbredd är standardvärden
          här; i skarp drift hämtas de från ert GIS och NVDB. Underhållsfaktor{" "}
          {nf(profile.maintenanceFactor, 2)}.
        </Typography>
      </Collapse>
    </Paper>
  );
}

export default ProfileCard;
