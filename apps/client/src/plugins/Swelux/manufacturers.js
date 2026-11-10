// Manufacturers in the catalogue, and which of them the user calculates with.
// Pure functions, so they can be tested without a map.

const byName = (a, b) => a.localeCompare(b, "sv");
const norm = (s) =>
  String(s || "")
    .trim()
    .toLocaleLowerCase("sv");

/**
 * The catalogue's manufacturers, by name: `{ name, id, count }`. `id` is the
 * platform's manufacturer id when it sends one.
 */
export function manufacturersOf(luminaires) {
  const found = new Map();
  luminaires.forEach((l) => {
    const name = l.manufacturer || "Okänd";
    const m = found.get(name) || {
      name,
      id: l.manufacturerId || null,
      count: 0,
    };
    m.count += 1;
    found.set(name, m);
  });
  return [...found.values()].sort((a, b) => byName(a.name, b.name));
}

/**
 * The manufacturers selected at start: the user's last choice, else the
 * tool's `defaultManufacturers` (names, matched without regard to case),
 * else all. Names that are no longer in the catalogue are dropped; if
 * nothing is left, all are selected.
 */
export function initialSelection(manufacturers, saved, defaults) {
  const pick = (names) => {
    const wanted = new Set((names || []).map(norm));
    return manufacturers.map((m) => m.name).filter((n) => wanted.has(norm(n)));
  };
  const all = manufacturers.map((m) => m.name);
  for (const names of [saved, defaults]) {
    const chosen = pick(names);
    if (chosen.length) return chosen;
  }
  return all;
}

/** The luminaires of the selected manufacturers, grouped by manufacturer. */
export function luminairesOf(luminaires, selected) {
  const chosen = new Set(selected);
  return luminaires
    .filter((l) => chosen.has(l.manufacturer || "Okänd"))
    .sort(
      (a, b) =>
        byName(a.manufacturer || "", b.manufacturer || "") ||
        byName(a.name || "", b.name || "")
    );
}
