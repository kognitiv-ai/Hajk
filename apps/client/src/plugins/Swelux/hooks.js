import React from "react";
import { lumLabel } from "./utils";

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
          luminaires: [...list].sort((a, b) =>
            lumLabel(a).localeCompare(lumLabel(b), "sv")
          ),
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
