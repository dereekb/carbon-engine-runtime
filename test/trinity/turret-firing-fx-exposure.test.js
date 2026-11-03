// EveTurretFiringFX asks its stretch elements Carbon's exposure-table questions (BlueCastPtr / QueryInterface,
// EveTurretFiringFX.cpp:216-226, 746-831), which read the Blue interface map - not the JavaScript class chain.
// See the decision page cjsmodel-composition-decorators ("Native exposure queries").
import assert from "node:assert/strict";
import test from "node:test";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { YamlWriter } from "../../npm/dist/blue/blue/index.js";
import { YamlReader } from "../../npm/dist/blue/blue/formats/yaml/YamlReader.js";
import { EveChildQuad, EveComponentRegistry, EveStretch2, EveTurretFiringFX } from "../../npm/dist/trinity/index.js";

test("EveTurretFiringFX registers only elements whose exposure table maps EveEntity", () =>
{
  const fx = new EveTurretFiringFX();
  fx.display = true;
  fx.isFiring = true;
  // EveChildQuad inherits EveEntity in JavaScript, but its Blue exposure table does not map EveEntity.
  const quad = new EveChildQuad();
  const stretch = new EveStretch2();
  fx.stretch.push(stretch, quad);
  const registry = new EveComponentRegistry();
  fx.Register(registry);
  try
  {
    assert.equal(stretch.GetComponentRegistry(), registry, "EveStretch2 maps EveEntity, so it registers");
    assert.equal(quad.GetComponentRegistry(), null, "the JS ancestor chain alone does not make an EveEntity");
  }
  finally { registry.Clear(); }
});

test("EveTurretFiringFX forwards controller calls only to ITr2ControllerOwner elements", () =>
{
  const fx = new EveTurretFiringFX();
  const stretch = new EveStretch2();
  fx.stretch.push(stretch);
  // EveStretch2 is not an ITr2ControllerOwner (the pulse asset's case); it has no controller methods to call.
  assert.equal(stretch.SetControllerVariable, undefined);
  fx.SetControllerVariable("Power", 1);
  fx.HandleControllerEvent("Fire");
  fx.StartControllers();
});

// Carbon exposes firingDelay1..12 over m_perMuzzleData[i].constantDelay
// (EveTurretFiringFX_Blue.cpp:33-44), a fixed array of MUZZLECOUNT_MAX records
// (EveTurretFiringFX.h:198), so every delay survives save and load.
test("EveTurretFiringFX firing delays are the twelve muzzle records' constant delays and round-trip", () =>
{
  const delays = Array.from({ length: 12 }, (_, i) => (i + 1) * 0.125);
  const values = Object.fromEntries(delays.map((delay, i) => [ `firingDelay${i + 1}`, delay ]));
  const fx = CjsSchema.from("EveTurretFiringFX", values);
  assert.equal(fx._perMuzzleData.length, 12);
  assert.deepEqual(fx._perMuzzleData.map(data => data.constantDelay), delays);
  assert.ok(fx._perMuzzleData.every(data => data.muzzlePositionBoneID === EveTurretFiringFX.INVALID_INDEX));

  const restored = new YamlReader().CreateObjectFromString(new YamlWriter().WriteObjectToString(fx));
  assert.deepEqual(restored._perMuzzleData.map(data => data.constantDelay), delays);
  const exported = CjsSchema.getValues(restored);
  assert.deepEqual(delays.map((_, i) => exported[`firingDelay${i + 1}`]), delays);

  // A shorter stretch list does not shrink the records or drop a delay.
  fx.stretch.push(new EveStretch2());
  fx.Initialize();
  assert.equal(fx._perMuzzleData.length, 12);
  assert.equal(fx.firingDelay12, delays[11]);
});
