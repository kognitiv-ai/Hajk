import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  InputAdornment,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";

import StreetSummary from "./components/StreetSummary";
import ProfileCard from "./components/ProfileCard";
import VerdictCard from "./components/VerdictCard";
import RankingList from "./components/RankingList";
import DetailsDialog from "./components/DetailsDialog";
import { lumLabel, nf, profileFor } from "./utils";

function SweluxView({ model, options, localObserver }) {
  const defaults = options.defaultProfile || {};
  const hours = options.operatingHoursPerYear || 4000;

  const [streets, setStreets] = React.useState(model.getStreets());
  const [context, setContext] = React.useState(model.getContext());
  const [street, setStreet] = React.useState(null);
  const [clicked, setClicked] = React.useState(null);
  const [profile, setProfile] = React.useState(profileFor(null, defaults));
  const [luminaires, setLuminaires] = React.useState([]);
  const [luminaire, setLuminaire] = React.useState(null);
  const [evaluation, setEvaluation] = React.useState(null); // single-luminaire response
  const [ranking, setRanking] = React.useState(null); // whole-catalogue response
  const [busy, setBusy] = React.useState(null); // null | "calc" | "rank"
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState(null);
  const [photometry, setPhotometry] = React.useState(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  React.useEffect(() => {
    const a = localObserver.subscribe("swelux.streetsReady", setStreets);
    const c = localObserver.subscribe("swelux.context", setContext);
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
      localObserver.unsubscribe(c);
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

  const shown = evaluation || ranking;
  const result =
    luminaire &&
    (evaluation?.results.find((r) => r.luminaireId === luminaire.id) ||
      ranking?.results.find((r) => r.luminaireId === luminaire.id));

  const resultId = result?.luminaireId;
  React.useEffect(() => {
    setPhotometry(null);
    if (!resultId) return;
    let live = true;
    model
      .fetchPhotometry(resultId)
      .then((p) => live && setPhotometry(p))
      .catch(() => {}); // no readable LDT: the card simply shows no diagram
    return () => {
      live = false;
    };
  }, [model, resultId]);

  React.useEffect(() => {
    model.setVerdict(result ? (result.compliant ? "pass" : "fail") : null);
  }, [model, result]);

  const changeProfile = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setEvaluation(null);
    setRanking(null);
  };

  const selectLuminaire = (id) => {
    setLuminaire(luminaires.find((l) => l.id === id) || null);
  };

  const run = async (kind) => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "calc") {
        const r = await model.evaluate(profile, [luminaire.id]);
        if (r.results.length === 0) {
          throw new Error(
            "Armaturen saknar användbar ljusdata (effekt) och kan inte beräknas."
          );
        }
        setEvaluation(r);
      } else {
        const r = await model.evaluate(profile, null);
        setEvaluation(null);
        setRanking(r);
        if (r.results.length) selectLuminaire(r.results[0].luminaireId);
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
      getOptionLabel={(s) => s.name}
      renderOption={({ key, ...props }, s) => (
        <li key={key} {...props}>
          <Box sx={{ flex: 1 }}>{s.name}</Box>
          <Typography variant="caption" color="text.secondary">
            {s.stats.count} ljuspunkter
          </Typography>
        </li>
      )}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      onChange={(e, s) => s && model.selectStreet(s.key, null, true)}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Sök gata …"
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );

  const noData = context?.lightingPointCount === 0;

  return (
    <Stack spacing={2}>
      {!noData && streetPicker}

      {noData ? (
        <Alert severity="info">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Ingen kartdata för {context.name} ännu
          </Typography>
          <Typography variant="body2">
            Kommunens ljuspunkter läggs in av swelux (swelux-CSV eller GeoJSON).
            Kontakta din kontaktperson så visas de här.
          </Typography>
        </Alert>
      ) : !street ? (
        <Stack
          alignItems="center"
          spacing={1}
          sx={{ py: 3, textAlign: "center" }}
        >
          <TouchAppOutlinedIcon color="action" sx={{ fontSize: 40 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Klicka på en ljuspunkt i kartan
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 320 }}
          >
            Hela gatan väljs och kan beräknas enligt EN 13201 mot alla armaturer
            i katalogen, eller en du väljer själv.
          </Typography>
        </Stack>
      ) : (
        <>
          <StreetSummary street={street} clicked={clicked} />
          <ProfileCard profile={profile} onChange={changeProfile} />

          <Box>
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disableElevation
              startIcon={<AutoAwesomeIcon />}
              disabled={!!busy}
              onClick={() => run("rank")}
            >
              Hitta bästa armatur
            </Button>
            {busy ? (
              <Box sx={{ mt: 1 }}>
                <LinearProgress color="secondary" />
                <Typography variant="caption" color="text.secondary">
                  {busy === "rank"
                    ? `Beräknar ${nf(luminaires.length)} armaturer mot gatans profil … ${elapsed} s`
                    : "Beräknar …"}
                </Typography>
              </Box>
            ) : (
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 0.75, textAlign: "center" }}
              >
                Beräknar alla {nf(luminaires.length)} armaturer i katalogen mot
                gatans profil
              </Typography>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {result && shown && (
            <VerdictCard
              result={result}
              evaluation={shown}
              street={street}
              hours={hours}
              photometry={photometry}
              onDetails={() => setDetailsOpen(true)}
            />
          )}

          {result && (
            <DetailsDialog
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              model={model}
              street={street}
              profile={profile}
              luminaireId={result.luminaireId}
              photometry={photometry}
            />
          )}

          {ranking && (
            <RankingList
              ranking={ranking}
              selectedId={luminaire?.id}
              onSelect={selectLuminaire}
            />
          )}

          <Divider>
            <Typography variant="caption" color="text.secondary">
              eller välj armatur själv
            </Typography>
          </Divider>

          <Stack direction="row" spacing={1}>
            <Autocomplete
              size="small"
              sx={{ flex: 1, minWidth: 0 }}
              options={luminaires}
              value={luminaire}
              getOptionLabel={lumLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(e, l) => {
                setLuminaire(l);
                setEvaluation(null);
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder="Tillverkare, modell …" />
              )}
            />
            <Button
              variant="outlined"
              disabled={!luminaire || !!busy}
              onClick={() => run("calc")}
            >
              Beräkna
            </Button>
          </Stack>
        </>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
        Beräknat med{" "}
        <Link
          href="https://swelux.ai"
          target="_blank"
          rel="noopener"
          color="inherit"
        >
          swelux.ai
        </Link>{" "}
        enligt EN 13201-2/-3 och tillverkarnas ljusdata. Förhandsversion.
        {context && (
          <>
            {" "}
            Visar {context.name}
            {context.canSwitch && (
              <>
                {" · "}
                <Link href="/login?switch" color="inherit">
                  Byt organisation
                </Link>
              </>
            )}
            .
          </>
        )}
      </Typography>
    </Stack>
  );
}

export default SweluxView;
