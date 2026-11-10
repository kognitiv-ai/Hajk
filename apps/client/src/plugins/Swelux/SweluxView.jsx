import React from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import StreetPicker from "./components/StreetPicker";
import StreetSummary from "./components/StreetSummary";
import ProfileCard from "./components/ProfileCard";
import ManufacturerFilter from "./components/ManufacturerFilter";
import VerdictCard from "./components/VerdictCard";
import RankingList from "./components/RankingList";
import LuminairePicker from "./components/LuminairePicker";
import MapNotice from "./components/MapNotice";
import Footer from "./components/Footer";
import {
  useElapsed,
  useManufacturerChoice,
  useDetailsLink,
  useModelEvent,
  usePhotometry,
  useReferenceData,
} from "./hooks";
import { luminairesOf } from "./manufacturers";
import { nf, profileFor } from "./utils";

function SweluxView({ model, options, localObserver }) {
  const defaults = options.defaultProfile || {};
  const hours = options.operatingHoursPerYear || 4000;

  const {
    classes,
    surfaces,
    luminaires,
    error: loadError,
  } = useReferenceData(model);
  const { manufacturers, selected, choose } = useManufacturerChoice(
    luminaires,
    options.defaultManufacturers
  );
  const offered = React.useMemo(
    () => luminairesOf(luminaires, selected),
    [luminaires, selected]
  );
  const allManufacturers = selected.length === manufacturers.length;
  const [streets, setStreets] = React.useState(model.getStreets());
  const [context, setContext] = React.useState(model.getContext());
  const [layerProblem, setLayerProblem] = React.useState(
    model.getLayerProblem()
  );
  const [street, setStreet] = React.useState(null);
  const [clicked, setClicked] = React.useState(null);
  const [profile, setProfile] = React.useState(() =>
    profileFor(null, defaults, [])
  );
  const [luminaire, setLuminaire] = React.useState(null);
  const [evaluation, setEvaluation] = React.useState(null); // one luminaire
  const [ranking, setRanking] = React.useState(null); // the whole catalogue
  const [busy, setBusy] = React.useState(null); // null | { kind, startedAt }
  const [error, setError] = React.useState(null);
  const elapsed = useElapsed(busy?.startedAt);

  useModelEvent(localObserver, "swelux.streetsReady", setStreets);
  useModelEvent(localObserver, "swelux.context", setContext);
  useModelEvent(localObserver, "swelux.layerProblem", setLayerProblem);
  useModelEvent(localObserver, "swelux.streetSelected", (e) => {
    setStreet(e.street);
    setClicked(e.clicked);
    setProfile(profileFor(e.street, defaults, surfaces));
    setEvaluation(null);
    setRanking(null);
    setError(null);
  });

  // The default road surface is configured by name and resolved once the
  // platform's surfaces have loaded.
  const calculated = profile.street.roadSurfaceId
    ? profile
    : {
        ...profile,
        street: {
          ...profile.street,
          roadSurfaceId: profileFor(null, defaults, surfaces).street
            .roadSurfaceId,
        },
      };
  const ready = !!calculated.street.roadSurfaceId;

  const shown = evaluation || ranking;
  const result =
    luminaire && shown?.results.find((r) => r.luminaire.id === luminaire.id);
  const photometry = usePhotometry(model, result?.luminaire.id);

  React.useEffect(() => {
    model.setVerdict(
      result?.status === "Compliant"
        ? "pass"
        : result?.status === "NonCompliant"
          ? "fail"
          : null
    );
  }, [model, result]);

  const changeProfile = (section, key, value) => {
    setProfile((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
    setEvaluation(null);
    setRanking(null);
  };

  // The whole catalogue, or only the chosen manufacturers. A platform that
  // doesn't know manufacturer ids ranks everything, and the result is narrowed here.
  const rankChosen = async () => {
    if (allManufacturers) return model.api.evaluate(calculated, null);
    const ids = manufacturers
      .filter((m) => selected.includes(m.name))
      .map((m) => m.id);
    if (ids.every(Boolean)) return model.api.evaluate(calculated, null, ids);
    const r = await model.api.evaluate(calculated, null);
    const keep = new Set(offered.map((l) => l.id));
    return {
      ...r,
      results: r.results.filter((x) => keep.has(x.luminaire.id)),
      skipped: r.skipped.filter((x) => keep.has(x.luminaireId)),
    };
  };

  const run = async (kind) => {
    setBusy({ kind, startedAt: Date.now() });
    setError(null);
    try {
      if (kind === "calc") {
        const r = await model.api.evaluate(calculated, [luminaire.id]);
        if (r.results.length === 0) {
          const reason = r.skipped[0]?.reason;
          throw new Error(
            `Armaturen kan inte beräknas${reason ? `: ${reason}` : "."}`
          );
        }
        setEvaluation(r);
      } else {
        const r = await rankChosen();
        setEvaluation(null);
        setRanking(r);
        if (r.results.length) setLuminaire(r.results[0].luminaire);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const details = useDetailsLink(model, setError);

  const showPicker = !layerProblem && context?.lightPointCount !== 0;

  return (
    <Stack spacing={2}>
      {showPicker && (
        <StreetPicker
          streets={streets}
          street={street}
          onSelect={(s) => model.selectStreet(s.key, null, true)}
        />
      )}

      {!street || !showPicker ? (
        <MapNotice layerProblem={layerProblem} context={context} />
      ) : (
        <>
          <StreetSummary street={street} clicked={clicked} />
          <ProfileCard
            profile={calculated}
            onChange={changeProfile}
            classes={classes}
            surfaces={surfaces}
          />

          {manufacturers.length > 1 && (
            <ManufacturerFilter
              manufacturers={manufacturers}
              selected={selected}
              onChange={(names) => {
                choose(names);
                setRanking(null);
                setEvaluation(null);
              }}
            />
          )}

          <Box>
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disableElevation
              startIcon={<AutoAwesomeIcon />}
              disabled={!!busy || !ready}
              onClick={() => run("rank")}
            >
              Hitta bästa armatur
            </Button>
            {busy ? (
              <Box sx={{ mt: 1 }}>
                <LinearProgress color="secondary" />
                <Typography variant="caption" color="text.secondary">
                  {busy.kind === "rank"
                    ? `Beräknar ${nf(offered.length)} armaturer mot gatans profil … ${elapsed} s`
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
                {allManufacturers
                  ? `Beräknar alla ${nf(offered.length)} armaturer i katalogen mot gatans profil`
                  : `Beräknar ${nf(offered.length)} armaturer från ${selected.length} tillverkare mot gatans profil`}
              </Typography>
            )}
          </Box>

          {(error || loadError) && (
            <Alert severity="error">{error || loadError}</Alert>
          )}

          {result && (
            <VerdictCard
              result={result}
              lightingClass={shown.lightingClass}
              street={street}
              hours={hours}
              photometry={photometry}
              onOpenDetails={
                options.detailsLink === false
                  ? null
                  : () => details.open(calculated, result.luminaire.id)
              }
              opening={details.opening}
            />
          )}

          {ranking && (
            <RankingList
              ranking={ranking}
              selectedId={luminaire?.id}
              onSelect={(id) =>
                setLuminaire(luminaires.find((l) => l.id === id) || null)
              }
              luminaires={luminaires}
            />
          )}

          <LuminairePicker
            luminaires={offered}
            luminaire={luminaire}
            onChange={(l) => {
              setLuminaire(l);
              setEvaluation(null);
            }}
            onCalculate={() => run("calc")}
            disabled={!!busy || !ready}
          />
        </>
      )}

      <Footer context={context} />
    </Stack>
  );
}

export default SweluxView;
