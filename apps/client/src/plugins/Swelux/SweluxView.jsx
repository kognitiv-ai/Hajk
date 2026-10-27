import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

const CLASSES = [
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "C3",
  "C4",
  "C5",
  "P2",
  "P3",
  "P4",
];
const SURFACES = ["R1", "R2", "R3", "R4", "C1", "C2"];
const ARRANGEMENTS = [
  { value: "single", label: "Enkelsidig" },
  { value: "staggered", label: "Växelvis" },
  { value: "opposite", label: "Motstående" },
  { value: "central", label: "Mittförlagd" },
];

const nf = (v, d = 0) =>
  v == null || Number.isNaN(v)
    ? "–"
    : Number(v).toLocaleString("sv-SE", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const lumLabel = (l) =>
  l
    ? `${l.manufacturer || "Okänd"} · ${l.name}${l.wattage ? ` · ${nf(l.wattage)} W` : ""}`
    : "";

function profileFor(street, defaults) {
  const spacing = street?.stats.spacingM;
  return {
    ...defaults,
    spacingM:
      spacing && spacing >= 12 && spacing <= 80
        ? Math.round(spacing)
        : defaults.spacingM,
  };
}

// Pass/fail rows for the class family: luminance for M, illuminance for C/P.
function checksFor(result, target) {
  if (!result || !target) return [];
  if (target.family === "M") {
    return [
      {
        label: "Luminans Lm (cd/m²)",
        value: result.lavg,
        req: target.lavgMin,
        op: "≥",
        d: 2,
      },
      {
        label: "Total jämnhet U0",
        value: result.u0,
        req: target.u0Min,
        op: "≥",
        d: 2,
      },
      {
        label: "Längsjämnhet Ul",
        value: result.ul,
        req: target.ulMin,
        op: "≥",
        d: 2,
      },
      {
        label: "Bländning TI (%)",
        value: result.ti,
        req: target.tiMax,
        op: "≤",
        d: 1,
      },
    ]
      .filter((c) => c.req != null)
      .map((c) => ({
        ...c,
        ok: c.op === "≥" ? c.value >= c.req : c.value <= c.req,
      }));
  }
  return [
    {
      label: "Belysningsstyrka Em (lx)",
      value: result.eavg,
      req: target.eavgMin,
      op: "≥",
      d: 1,
    },
    {
      label: "Total jämnhet U0",
      value: result.u0,
      req: target.u0Min,
      op: "≥",
      d: 2,
    },
  ]
    .filter((c) => c.req != null && c.req > 0)
    .map((c) => ({ ...c, ok: c.value >= c.req }));
}

function SweluxView({ model, options, localObserver }) {
  const defaults = options.defaultProfile || {};
  const hours = options.operatingHoursPerYear || 4000;

  const [streets, setStreets] = React.useState(model.getStreets());
  const [street, setStreet] = React.useState(null);
  const [clicked, setClicked] = React.useState(null);
  const [profile, setProfile] = React.useState(profileFor(null, defaults));
  const [luminaires, setLuminaires] = React.useState([]);
  const [luminaire, setLuminaire] = React.useState(null);
  const [evaluation, setEvaluation] = React.useState(null); // last API response
  const [ranking, setRanking] = React.useState(null); // whole-catalogue response
  const [busy, setBusy] = React.useState(null); // null | "calc" | "rank"
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const a = localObserver.subscribe("swelux.streetsReady", setStreets);
    const b = localObserver.subscribe("swelux.streetSelected", (e) => {
      setStreet(e.street);
      setClicked(e.clicked);
      setProfile(profileFor(e.street, defaults));
      setEvaluation(null);
      setRanking(null);
      setError(null);
    });
    return () => {
      localObserver.unsubscribe(a);
      localObserver.unsubscribe(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localObserver]);

  React.useEffect(() => {
    model
      .fetchLuminaires()
      .then((list) =>
        setLuminaires(
          list.sort((a, b) => lumLabel(a).localeCompare(lumLabel(b), "sv"))
        )
      )
      .catch((e) => setError(e.message));
  }, [model]);

  React.useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      500
    );
    return () => clearInterval(t);
  }, [busy]);

  const result =
    luminaire &&
    (evaluation?.results.find((r) => r.luminaireId === luminaire.id) ||
      ranking?.results.find((r) => r.luminaireId === luminaire.id));
  const target = (evaluation || ranking)?.target;
  const checks = checksFor(result, target);

  React.useEffect(() => {
    model.setVerdict(result ? (result.compliant ? "pass" : "fail") : null);
  }, [model, result]);

  const setField =
    (key, numeric = true) =>
    (e) => {
      const v = numeric ? Number(e.target.value) : e.target.value;
      setProfile((p) => ({ ...p, [key]: v }));
      setEvaluation(null);
      setRanking(null);
    };

  const run = async (kind) => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "calc") {
        setEvaluation(await model.evaluate(profile, [luminaire.id]));
      } else {
        const r = await model.evaluate(profile, null);
        setRanking(r);
        const best = r.results.find((x) => x.compliant);
        if (best)
          setLuminaire(
            luminaires.find((l) => l.id === best.luminaireId) || null
          );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const streetPicker = (
    <Autocomplete
      size="small"
      options={streets}
      value={street}
      getOptionLabel={(s) => `${s.name} (${s.stats.count})`}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      onChange={(e, s) => s && model.selectStreet(s.key, null, true)}
      renderInput={(params) => <TextField {...params} label="Sök gata" />}
    />
  );

  if (!street) {
    return (
      <Stack spacing={2}>
        <Typography variant="body1">
          Klicka på en ljuspunkt i kartan, eller sök fram en gata. Hela gatan
          väljs och kan beräknas enligt EN 13201 med valfri armatur ur
          katalogen.
        </Typography>
        {streetPicker}
        {error && <Alert severity="error">{error}</Alert>}
        <Footer />
      </Stack>
    );
  }

  const existingW = street.stats.avgWattage;
  const newW = result?.powerW;
  const savedKwh =
    existingW && newW
      ? ((existingW - newW) * street.stats.count * hours) / 1000
      : null;

  return (
    <Stack spacing={2}>
      {streetPicker}

      <Box>
        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
          {street.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {street.area}
          {clicked ? ` · vald stolpe ${clicked.stolpe}` : ""}
        </Typography>
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Stat label="Ljuspunkter" value={nf(street.stats.count)} />
          <Stat
            label="Snitteffekt idag"
            value={existingW ? `${nf(existingW)} W` : "–"}
          />
          <Stat
            label="Stolpavstånd (uppskattat)"
            value={
              street.stats.spacingM ? `${nf(street.stats.spacingM)} m` : "–"
            }
          />
          <Stat
            label="Vanligaste armatur"
            value={street.stats.typicalLuminaire || "–"}
          />
        </Grid>
      </Box>

      <Divider />

      <Box>
        <Typography variant="overline" color="text.secondary">
          Vägprofil
        </Typography>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Field
            label="Belysningsklass"
            value={profile.requiredClass}
            onChange={setField("requiredClass", false)}
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
            onChange={setField("roadWidthM")}
            type="number"
          />
          <Field
            label="Stolpavstånd (m)"
            value={profile.spacingM}
            onChange={setField("spacingM")}
            type="number"
          />
          <Field
            label="Ljuspunktshöjd (m)"
            value={profile.poleHeightM}
            onChange={setField("poleHeightM")}
            type="number"
          />
          <Field
            label="Uppställning"
            value={profile.arrangement}
            onChange={setField("arrangement", false)}
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
            onChange={setField("surfaceClass", false)}
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
          sx={{ mt: 1 }}
        >
          Stolpavståndet är uppskattat från era ljuspunkter. Klass och vägbredd
          är standardvärden här; i skarp drift hämtas de från ert GIS och NVDB.
          Underhållsfaktor {nf(profile.maintenanceFactor, 2)}.
        </Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="overline" color="text.secondary">
          Armatur
        </Typography>
        <Autocomplete
          size="small"
          sx={{ mt: 0.5 }}
          options={luminaires}
          value={luminaire}
          getOptionLabel={lumLabel}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(e, l) => {
            setLuminaire(l);
            if (!ranking?.results.some((r) => r.luminaireId === l?.id))
              setEvaluation(null);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={`Välj bland ${nf(luminaires.length)} armaturer`}
            />
          )}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            disableElevation
            disabled={!luminaire || !!busy}
            onClick={() => run("calc")}
          >
            Beräkna
          </Button>
          <Button
            variant="outlined"
            disabled={!!busy}
            onClick={() => run("rank")}
          >
            Hitta bästa armatur
          </Button>
        </Stack>
        {busy && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress color="secondary" />
            <Typography variant="caption" color="text.secondary">
              {busy === "rank"
                ? `Beräknar hela katalogen mot gatans profil … ${elapsed} s`
                : "Beräknar …"}
            </Typography>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
      </Box>

      {result && target && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip
              size="small"
              icon={result.compliant ? <CheckCircleIcon /> : <CancelIcon />}
              color={result.compliant ? "success" : "error"}
              label={`${result.compliant ? "Uppfyller" : "Uppfyller inte"} ${(evaluation || ranking).requiredClass}`}
            />
            <Typography variant="body2" color="text.secondary" noWrap>
              {result.manufacturer} · {result.name}
            </Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Krav</TableCell>
                <TableCell align="right">Beräknat</TableCell>
                <TableCell align="right">Behövs</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.label}>
                  <TableCell>{c.label}</TableCell>
                  <TableCell align="right">{nf(c.value, c.d)}</TableCell>
                  <TableCell align="right">
                    {c.op} {nf(c.req, c.d)}
                  </TableCell>
                  <TableCell padding="checkbox">
                    {c.ok ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <CancelIcon fontSize="small" color="error" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            {nf(newW, 1)} W per ljuspunkt mot{" "}
            {existingW ? `${nf(existingW)} W` : "okänt"} idag.
            {savedKwh != null &&
              (savedKwh > 0
                ? ` Cirka ${nf(savedKwh)} kWh lägre förbrukning per år för gatan (${nf(hours)} h/år).`
                : ` Cirka ${nf(-savedKwh)} kWh högre förbrukning per år för gatan.`)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Jämförelsen avser lampeffekt i ert register; äldre armaturer drar
            oftast mer i väggen.
          </Typography>
        </Box>
      )}

      {ranking && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {nf(ranking.calculated)} armaturer beräknade ·{" "}
            {nf(ranking.compliantCount)} uppfyller {ranking.requiredClass}
          </Typography>
          {ranking.compliantCount === 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Ingen armatur i katalogen klarar kraven med den här profilen.
              Prova kortare stolpavstånd eller högre ljuspunkt.
            </Alert>
          )}
          <List dense disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
            {ranking.results
              .slice(
                0,
                ranking.compliantCount
                  ? Math.min(10, ranking.compliantCount)
                  : 5
              )
              .map((r, i) => (
                <ListItemButton
                  key={r.luminaireId}
                  selected={luminaire?.id === r.luminaireId}
                  onClick={() =>
                    setLuminaire(
                      luminaires.find((l) => l.id === r.luminaireId) || null
                    )
                  }
                >
                  <ListItemText
                    primary={`${i + 1}. ${r.name}`}
                    secondary={`${r.manufacturer} · ${nf(r.powerW, 1)} W · ${
                      target?.family === "M"
                        ? `Lm ${nf(r.lavg, 2)} cd/m²`
                        : `Em ${nf(r.eavg, 1)} lx`
                    }${r.compliant ? "" : " · klarar ej"}`}
                  />
                </ListItemButton>
              ))}
          </List>
        </Box>
      )}

      <Footer />
    </Stack>
  );
}

function Stat({ label, value }) {
  return (
    <Grid size={6}>
      <Box
        sx={{
          bgcolor: "action.hover",
          borderRadius: 1,
          px: 1.25,
          py: 0.75,
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          component="div"
        >
          {label}
        </Typography>
        <Typography variant="body2" noWrap title={value}>
          {value}
        </Typography>
      </Box>
    </Grid>
  );
}

function Field({ children, ...props }) {
  return (
    <Grid size={6}>
      <TextField size="small" fullWidth {...props}>
        {children}
      </TextField>
    </Grid>
  );
}

function Footer() {
  return (
    <Typography variant="caption" color="text.secondary">
      Beräknat med swelux.ai-motorn enligt EN 13201-2/-3 och tillverkarnas
      ljusdata (LDT). Förhandsversion för pilot.
    </Typography>
  );
}

export default SweluxView;
