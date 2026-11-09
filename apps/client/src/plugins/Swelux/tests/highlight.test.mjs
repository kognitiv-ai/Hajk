import { test } from "node:test";
import assert from "node:assert/strict";
import { litStretches } from "../highlight.js";

test("litStretches keeps only the part of a road near light points", () => {
  // A 300 m road in metres, with light points along its first 100 m.
  const road = [
    [0, 0],
    [300, 0],
  ];
  const points = [
    [0, 10],
    [50, 10],
    [100, 10],
  ];
  const runs = litStretches(road, points, 1);
  assert.equal(runs.length, 1);
  const xs = runs[0].map((c) => c[0]);
  assert.equal(Math.min(...xs), 0);
  assert.ok(Math.max(...xs) >= 130 && Math.max(...xs) <= 135);
});

test("litStretches finds nothing on a road without light points", () => {
  assert.deepEqual(
    litStretches(
      [
        [0, 0],
        [300, 0],
      ],
      [[1000, 1000]],
      1
    ),
    []
  );
});
