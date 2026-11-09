// Run from apps/client: node --test src/plugins/Swelux/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupByStreet,
  medianNeighbourDistance,
  readLightPoint,
  streetStats,
} from "../streets.js";
import { NO_STREET } from "../utils.js";

const planar = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const entry = (props, lonLat = [0, 0]) => ({
  point: readLightPoint((name) => props[name]),
  lonLat,
});

test("readLightPoint reads the default property names", () => {
  const p = readLightPoint(
    (name) => ({ streetId: 7, street: "Storgatan", poleHeight: 8 })[name]
  );
  assert.equal(p.streetId, 7);
  assert.equal(p.street, "Storgatan");
  assert.equal(p.poleHeight, 8);
});

test("readLightPoint reads a municipality's own property names", () => {
  const props = { GATU_ID: "G12", GATUNAMN: "Kungsgatan", STOLPHOJD: "7,5" };
  const p = readLightPoint((name) => props[name], {
    streetId: "GATU_ID",
    street: "GATUNAMN",
    poleHeight: "STOLPHOJD",
  });
  assert.equal(p.streetId, "G12");
  assert.equal(p.street, "Kungsgatan");
  assert.equal(p.poleHeight, 7.5); // decimal comma, as in Swedish registers
});

test("readLightPoint leaves unreadable numbers out", () => {
  const p = readLightPoint(
    (name) => ({ existingWattage: "okänd", armLength: "" })[name]
  );
  assert.equal(p.existingWattage, null);
  assert.equal(p.armLength, null);
});

test("groupByStreet puts points without a street in their own group", () => {
  const groups = groupByStreet([
    entry({ streetId: 1 }),
    entry({ streetId: 1 }),
    entry({ streetId: null }),
    entry({ streetId: "" }),
  ]);
  assert.equal(groups.get("1").length, 2);
  assert.equal(groups.get(NO_STREET).length, 2);
});

test("medianNeighbourDistance is the median of nearest-neighbour distances", () => {
  // Poles 30 m apart, with one pole 5 m off: the median ignores it.
  const lonLats = [
    [0, 0],
    [30, 0],
    [60, 0],
    [90, 0],
    [95, 0],
  ];
  assert.equal(medianNeighbourDistance(lonLats, planar), 30);
});

test("medianNeighbourDistance needs at least three points", () => {
  assert.equal(
    medianNeighbourDistance(
      [
        [0, 0],
        [30, 0],
      ],
      planar
    ),
    null
  );
});

test("streetStats summarises a street's register", () => {
  const stats = streetStats(
    [
      entry(
        { existingWattage: 70, existingLuminaire: "A", poleHeight: 8 },
        [0, 0]
      ),
      entry(
        { existingWattage: 50, existingLuminaire: "A", poleHeight: 8 },
        [30, 0]
      ),
      entry(
        { existingWattage: null, existingLuminaire: "B", poleHeight: 6 },
        [60, 0]
      ),
    ],
    planar
  );
  assert.equal(stats.count, 3);
  assert.equal(stats.avgWattage, 60);
  assert.equal(stats.typicalLuminaire, "A");
  assert.equal(stats.spacing, 30);
  assert.equal(stats.poleHeight, 8);
  assert.equal(stats.armLength, null);
});
