import test from "node:test";
import assert from "node:assert/strict";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import * as CcpLog from "../../npm/dist/global/logging/ccpLog.js";
import { LogType } from "../../npm/dist/global/consts/ccpLog.js";
import "../../npm/dist/trinity/index.js";

/** Runs fn and returns the warnings it logged, as [ subtitle, message ]. */
function warningsOf(fn)
{
  const seen = [];
  const echo = (channel, type, userData, message) =>
  {
    if (type === LogType.LOGTYPE_WARN) seen.push([ userData && userData.subtitle, message ]);
  };
  CcpLog.RegisterLogEcho(echo, LogType.LOGTYPE_WARN);
  try { fn(); }
  finally { CcpLog.UnregisterLogEcho(echo); }
  return seen;
}

// A hull light as an older runtime's SOF wrote it: startTime, type and isDynamic are in no light's
// exposure (Tr2Light_Blue.cpp maps none), and the rest are Tr2PointLight's own rows.
const olderLight = { _type: "Tr2PointLight", startTime: 42.5, type: 1, isDynamic: false, flags: 9, radius: 4, boneIndex: 7, position: [ 1, 2, 3 ] };

test("a values bag from an older runtime loads, skipping what the class does not expose with one warning each", () =>
{
  let lights;
  const warnings = warningsOf(() =>
  {
    lights = CjsSchema.from("EveSpaceObject2", { _type: "EveSpaceObject2", lights: [ olderLight, { ...olderLight, radius: 5 } ] }).lights;
  });

  assert.equal(lights.length, 2);
  assert.equal(lights[0].radius, 4, "exposed rows still apply");
  assert.equal(lights[1].radius, 5);
  assert.equal(lights[0].boneIndex, 7);
  assert.deepEqual(Array.from(lights[0].position), [ 1, 2, 3 ]);
  assert.equal(lights[0].startTime === 42.5, false, "startTime is left to construction");

  // type is accepted: Tr2PointLight declares its own type field, outside Carbon's table.
  assert.deepEqual(warnings.map(([ subtitle ]) => subtitle), [ "values", "values" ], "once per attribute, on the values reader");
  for (const name of [ "startTime", "isDynamic" ])
  {
    assert.ok(warnings.some(([ , message ]) => message.includes(`'${name}'`) && message.includes("Tr2PointLight")), name);
  }
});

test("strict, the same bag fails the read, as Carbon's DictReader and BlackReader do", () =>
{
  assert.throws(() => CjsSchema.from("Tr2PointLight", olderLight, { strict: true }), /Invalid attribute: startTime/u);
});
