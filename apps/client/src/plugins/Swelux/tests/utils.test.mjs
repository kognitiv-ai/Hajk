import { test } from "node:test";
import assert from "node:assert/strict";
import { energyFor, profileFor, requirementText } from "../utils.js";

const defaults = {
  street: { lightingClass: "M4", width: 7, roadSurface: "CIE R3" },
  placement: { arrangement: "OneSide", spacing: 32, lightCentreHeight: 8 },
};
const surfaces = [
  { id: "r2", name: "CIE R2" },
  { id: "r3", name: "CIE R3" },
];

test("profileFor resolves the default road surface by name", () => {
  const p = profileFor(null, defaults, surfaces);
  assert.equal(p.street.roadSurfaceId, "r3");
  assert.equal(p.street.roadSurface, undefined);
  assert.equal(p.placement.spacing, 32);
});

test("profileFor takes plausible figures from the street's light points", () => {
  const street = { stats: { spacing: 27.6, poleHeight: 10, armLength: 1.5 } };
  const p = profileFor(street, defaults, surfaces);
  assert.equal(p.placement.spacing, 28);
  assert.equal(p.placement.lightCentreHeight, 10);
  assert.equal(p.placement.outreach, 1.5);
});

test("profileFor ignores implausible figures from the register", () => {
  const street = { stats: { spacing: 400, poleHeight: 0.5, armLength: 50 } };
  const p = profileFor(street, defaults, surfaces);
  assert.equal(p.placement.spacing, 32);
  assert.equal(p.placement.lightCentreHeight, 8);
  assert.equal(p.placement.outreach, undefined);
});

test("requirementText shows the limit the way the standard states it", () => {
  assert.equal(
    requirementText({
      unit: "cd/m²",
      requirement: { kind: "AtLeast", limit: 0.75 },
    }),
    "≥ 0,75"
  );
  assert.equal(
    requirementText({ unit: "%", requirement: { kind: "AtMost", limit: 15 } }),
    "≤ 15,0"
  );
});

test("energyFor compares the new luminaire with today's wattage", () => {
  const result = { powerPerKilometre: 1000, luminaire: { systemPower: 25 } };
  const street = { stats: { avgWattage: 50, count: 10 } };
  const e = energyFor(result, street, 4000);
  assert.equal(e.existingPerKm, 2000);
  assert.equal(e.savedPct, 50);
  assert.equal(e.savedKwh, 1000); // (50 − 25) W × 10 × 4000 h
});
