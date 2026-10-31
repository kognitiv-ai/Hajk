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
import { ARRANGEMENTS, arrangementLabel, nf } from "../utils";

function Field({ children, ...props }) {
  return (
    <Grid size={6}>
      <TextField size="small" fullWidth {...props}>
        {children}
      </TextField>
    </Grid>
  );
}

const metres = (v) => `${nf(v, 1).replace(",0", "")} m`;

/**
 * The street and its poles as a one-line summary; the full form opens on
 * demand so the actions stay above the fold. Fields are the platform's street
 * (class, width, lanes, surface, maintenance factor, Q0) and placement
 * (arrangement, spacing, light centre height, outreach, tilt).
 */
function ProfileCard({ profile, onChange, classes, surfaces }) {
  const [open, setOpen] = React.useState(false);
  const { street, placement } = profile;
  const surface = surfaces.find((s) => s.id === street.roadSurfaceId);

  const number = (section, key) => (e) =>
    onChange(
      section,
      key,
      e.target.value === "" ? null : Number(e.target.value)
    );
  const text = (section, key) => (e) => onChange(section, key, e.target.value);

  // A class from the profile that the standard doesn't list still shows.
  const classCodes = classes.map((c) => c.code);
  const classOptions = classCodes.includes(street.lightingClass)
    ? classes
    : [{ code: street.lightingClass, description: "" }, ...classes];

  const summary = [
    street.lightingClass,
    `${metres(street.width)} väg`,
    `${nf(placement.spacing)} m c/c`,
    `${metres(placement.lightCentreHeight)} höjd`,
    arrangementLabel(placement.arrangement).toLowerCase(),
    surface?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Paper variant="outlined" sx={{ px: 1.75, py: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Gata och stolpar
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
            value={street.lightingClass}
            onChange={text("street", "lightingClass")}
            select
          >
            {classOptions.map((c) => (
              <MenuItem key={c.code} value={c.code} title={c.description}>
                {c.code}
              </MenuItem>
            ))}
          </Field>
          <Field
            label="Beläggning"
            value={surface ? street.roadSurfaceId : ""}
            onChange={text("street", "roadSurfaceId")}
            select
          >
            {surfaces.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Field>
          <Field
            label="Vägbredd (m)"
            value={street.width ?? ""}
            onChange={number("street", "width")}
            type="number"
          />
          <Field
            label="Körfält"
            value={street.laneCount ?? ""}
            onChange={number("street", "laneCount")}
            type="number"
          />
          <Field
            label="Uppställning"
            value={placement.arrangement}
            onChange={text("placement", "arrangement")}
            select
          >
            {ARRANGEMENTS.map((a) => (
              <MenuItem key={a.value} value={a.value}>
                {a.label}
              </MenuItem>
            ))}
          </Field>
          <Field
            label="Stolpavstånd (m)"
            value={placement.spacing ?? ""}
            onChange={number("placement", "spacing")}
            type="number"
          />
          <Field
            label="Ljuspunktshöjd (m)"
            value={placement.lightCentreHeight ?? ""}
            onChange={number("placement", "lightCentreHeight")}
            type="number"
          />
          <Field
            label="Utliggare (m)"
            value={placement.outreach ?? ""}
            onChange={number("placement", "outreach")}
            type="number"
          />
          <Field
            label="Lutning (°)"
            value={placement.tiltDegrees ?? ""}
            onChange={number("placement", "tiltDegrees")}
            type="number"
          />
          <Field
            label="Underhållsfaktor"
            value={street.maintenanceFactor ?? ""}
            onChange={number("street", "maintenanceFactor")}
            type="number"
            slotProps={{ htmlInput: { step: 0.05, min: 0, max: 1 } }}
          />
          <Field
            label="Uppmätt Q0 (valfritt)"
            value={street.averageLuminanceCoefficient ?? ""}
            onChange={number("street", "averageLuminanceCoefficient")}
            type="number"
            placeholder={
              surface ? nf(surface.averageLuminanceCoefficient, 2) : ""
            }
            slotProps={{ htmlInput: { step: 0.01, min: 0, max: 1 } }}
          />
        </Grid>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 1.25, mb: 0.5 }}
        >
          Stolpavstånd, ljuspunktshöjd och utliggare är uppskattade från era
          ljuspunkter – kontrollera dem om stolparna står på båda sidor. Klass
          och vägbredd är standardvärden här; i skarp drift hämtas de från ert
          GIS och NVDB. Utan uppmätt Q0 används beläggningens eget värde.
        </Typography>
      </Collapse>
    </Paper>
  );
}

export default ProfileCard;
