import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialSelection,
  luminairesOf,
  manufacturersOf,
} from "../manufacturers.js";

const luminaires = [
  { id: 1, name: "B", manufacturer: "Thorn", manufacturerId: "t" },
  { id: 2, name: "A", manufacturer: "Thorn", manufacturerId: "t" },
  { id: 3, name: "C", manufacturer: "Fagerhult", manufacturerId: "f" },
  { id: 4, name: "D", manufacturer: "Schréder", manufacturerId: "s" },
];
const manufacturers = manufacturersOf(luminaires);

test("manufacturersOf lists each manufacturer once, by name, with counts", () => {
  assert.deepEqual(
    manufacturers.map((m) => [m.name, m.id, m.count]),
    [
      ["Fagerhult", "f", 1],
      ["Schréder", "s", 1],
      ["Thorn", "t", 2],
    ]
  );
});

test("initialSelection prefers the user's last choice", () => {
  assert.deepEqual(initialSelection(manufacturers, ["Schréder"], ["Thorn"]), [
    "Schréder",
  ]);
});

test("initialSelection falls back to the configured defaults, any case", () => {
  assert.deepEqual(
    initialSelection(manufacturers, [], ["thorn", "FAGERHULT"]),
    ["Fagerhult", "Thorn"]
  );
});

test("initialSelection selects all when nothing known is left", () => {
  assert.deepEqual(initialSelection(manufacturers, ["Gone AB"], undefined), [
    "Fagerhult",
    "Schréder",
    "Thorn",
  ]);
});

test("luminairesOf keeps the selected manufacturers, grouped and sorted", () => {
  assert.deepEqual(
    luminairesOf(luminaires, ["Thorn", "Fagerhult"]).map((l) => l.id),
    [3, 2, 1]
  );
});
