// Which parts of a street's centreline to highlight. Pure geometry on
// coordinate arrays in the map's projection, so it can be tested without a map.

// A road sample counts as lit when a light point of the street is this close.
export const LIT_DISTANCE_M = 35;
// Distance between the samples taken along the centreline.
export const SAMPLE_STEP_M = 5;

/**
 * The stretches of a line (an array of [x, y]) that have a light point within
 * LIT_DISTANCE_M. Road centrelines often run well past the lit part, and
 * same-named roads exist elsewhere, so only these stretches are drawn.
 * `unitsPerMetre` converts metres to map units at the street.
 */
export function litStretches(coords, pointCoords, unitsPerMetre) {
  if (coords.length < 2) return [];
  const maxSq = (LIT_DISTANCE_M * unitsPerMetre) ** 2;
  const step = SAMPLE_STEP_M * unitsPerMetre;
  const isLit = (c) =>
    pointCoords.some((p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 <= maxSq);

  const runs = [];
  let run = [];
  const visit = (c) => {
    if (isLit(c)) {
      run.push(c);
    } else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  };
  for (let i = 0; i < coords.length - 1; i++) {
    const [a, b] = [coords[i], coords[i + 1]];
    const n = Math.max(
      1,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
    );
    for (let k = 0; k < n; k++) {
      visit([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  visit(coords[coords.length - 1]);
  if (run.length > 1) runs.push(run);
  return runs;
}
