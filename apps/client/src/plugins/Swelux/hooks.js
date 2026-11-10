import React from "react";
import LocalStorageHelper from "../../utils/LocalStorageHelper";
import { functionalOk } from "../../models/Cookie";
import { initialSelection, manufacturersOf } from "./manufacturers";

/** Subscribes to one of the model's events for as long as the component lives. */
export function useModelEvent(localObserver, event, handler) {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  });
  React.useEffect(() => {
    const s = localObserver.subscribe(event, (v) => handlerRef.current(v));
    return () => localObserver.unsubscribe(s);
  }, [localObserver, event]);
}

/**
 * The platform's reference data: lighting classes, road surfaces and the
 * luminaires the map offers. Loaded once; a failure is reported as `error`.
 */
export function useReferenceData(model) {
  const [data, setData] = React.useState({
    classes: [],
    surfaces: [],
    luminaires: [],
    error: null,
  });
  React.useEffect(() => {
    let live = true;
    const update = (patch) => live && setData((d) => ({ ...d, ...patch }));
    const fail = (e) => update({ error: e.message });
    model.api
      .fetchLightingClasses()
      .then((classes) => update({ classes }))
      .catch(fail);
    model.api
      .fetchRoadSurfaces()
      .then((surfaces) => update({ surfaces }))
      .catch(fail);
    model.api
      .fetchLuminaires()
      .then((list) =>
        update({
          luminaires: list,
        })
      )
      .catch(fail);
    return () => {
      live = false;
    };
  }, [model]);
  return data;
}

/** Seconds since `startedAt` (a timestamp), ticking while it is set. */
export function useElapsed(startedAt) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
}

/** The photometry of one luminaire, or null while loading or when unreadable. */
export function usePhotometry(model, luminaireId) {
  const [loaded, setLoaded] = React.useState({ id: null, data: null });
  React.useEffect(() => {
    if (!luminaireId) return;
    let live = true;
    model.api
      .fetchPhotometry(luminaireId)
      .then((data) => live && setLoaded({ id: luminaireId, data }))
      .catch(() => {}); // no readable photometric file: no diagram
    return () => {
      live = false;
    };
  }, [model, luminaireId]);
  return loaded.id === luminaireId ? loaded.data : null;
}

const STORAGE_KEY = "swelux";

/**
 * The manufacturers the user calculates with, remembered in the browser per
 * map (when the user allows functional cookies). Starts from the last choice,
 * else the tool's `defaultManufacturers`, else all.
 */
export function useManufacturerChoice(luminaires, defaults) {
  const manufacturers = React.useMemo(
    () => manufacturersOf(luminaires),
    [luminaires]
  );
  const [chosen, setChosen] = React.useState(null); // null until the user changes it
  const selected = React.useMemo(
    () =>
      chosen ||
      initialSelection(
        manufacturers,
        LocalStorageHelper.get(STORAGE_KEY, { manufacturers: [] })
          .manufacturers,
        defaults
      ),
    [chosen, manufacturers, defaults]
  );
  const choose = (names) => {
    setChosen(names);
    if (functionalOk()) {
      LocalStorageHelper.set(STORAGE_KEY, { manufacturers: names });
    }
  };
  return { manufacturers, selected, choose };
}

/**
 * Opens swelux.ai's details page for a calculation. The window is opened at the
 * click, since one opened after the request would be blocked as a popup, and is
 * sent to the page once swelux.ai has saved the calculation.
 */
export function useDetailsLink(model, onError) {
  const [opening, setOpening] = React.useState(false);
  const open = async (calculation, luminaireId, street) => {
    const win = window.open("", "_blank");
    setOpening(true);
    onError(null);
    try {
      const { url } = await model.api.handover(
        calculation,
        luminaireId,
        street
      );
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (e) {
      win?.close();
      onError(e.message);
    } finally {
      setOpening(false);
    }
  };
  return { open, opening };
}
