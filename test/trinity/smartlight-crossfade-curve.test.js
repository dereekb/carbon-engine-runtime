import assert from "node:assert/strict";
import test from "node:test";
import { CjsSchema } from "../../npm/dist/global/schema/index.js";
import { CjsBlackReader } from "../../npm/dist/resource/formats/black/core/CjsBlackReader.js";
import { EveSmartLightBaseAttributeModifier } from "../../npm/dist/trinity/eve/smartLights/attributeModifiers/EveSmartLightBaseAttributeModifier.js";
import { EveSmartLightAttributeModifierColor } from "../../npm/dist/trinity/eve/smartLights/attributeModifiers/EveSmartLightAttributeModifierColor.js";

// EVE build 3698585 authors m_crossFadeCurve (int) where 3682781 authored
// m_crossFadeIntensity (float), and renamed m_delayedActivation to
// m_activationDelay. Its 44 authored curves are all 5, each where 3682781
// authored an intensity of 9.0288.
const OLD_INTENSITY = Math.fround(9.0288);

function Persisted(name)
{
  return CjsSchema.getSchema(EveSmartLightBaseAttributeModifier).members.find(member => member.name === name)?.edit?.persist;
}

function Decode(fields)
{
  const fixture = new BlackFixture();
  const reader = new CjsBlackReader(fixture.Finish(fixture.Object(1, "EveSmartLightAttributeModifierColor", fields)), { schema: null });
  const modifier = reader.ReadRuntime().root;
  assert.equal(reader.reader.AtEnd(), true);
  assert.deepEqual(reader.reports, []);
  return modifier;
}

/** activationValue through a deactivation and a reactivation, 12 steps of 0.1 s each. */
function CrossFade(setup)
{
  const modifier = new EveSmartLightAttributeModifierColor();
  setup(modifier);
  modifier.Initialize();
  const values = [ modifier.activationValue ];
  for (const active of [ false, true ])
  {
    modifier.active = active;
    modifier.OnModified("active");
    for (let i = 0; i < 12; i++)
    {
      modifier.UpdateActivationStrength(1, 0.1);
      values.push(modifier.activationValue);
    }
  }
  return values;
}

/** activationValue of a modifier authored active but not starting active, 10 steps of 0.1 s each. */
function Activation(setup)
{
  const modifier = new EveSmartLightAttributeModifierColor();
  modifier.startsActive = false;
  modifier.active = true;
  setup(modifier);
  modifier.Initialize();
  const values = [];
  for (let i = 0; i < 10; i++)
  {
    modifier.UpdateActivationStrength(1, 0.1);
    values.push(modifier.activationValue);
  }
  return values;
}

test("smart light modifiers persist the 3698585 crossfade curve and activation delay beside the old names", () =>
{
  for (const name of [ "crossFadeCurve", "activationDelay", "crossFadeIntensity", "delayedActivation" ])
  {
    assert.equal(Persisted(name), true, name);
  }
  const modifier = new EveSmartLightAttributeModifierColor();
  assert.equal(modifier.crossFadeCurve, 0);
  assert.equal(modifier.activationDelay, 0);
});

test("canonical Black reads a 3698585 modifier's curve and delay, and a 3682781 modifier's intensity and delay", () =>
{
  const current = Decode([ [ "crossFadeCurve", U32(5) ], [ "activationDelay", F32(0.8) ] ]);
  assert.equal(current.crossFadeCurve, 5);
  assert.equal(current.activationDelay, Math.fround(0.8));
  assert.equal(current.crossFadeIntensity, 1);
  assert.equal(current.delayedActivation, 0);

  const older = Decode([ [ "crossFadeIntensity", F32(9.0288) ], [ "delayedActivation", F32(2) ] ]);
  assert.equal(older.crossFadeIntensity, OLD_INTENSITY);
  assert.equal(older.delayedActivation, 2);
  assert.equal(older.crossFadeCurve, 0);
  assert.equal(older.activationDelay, 0);
});

test("crossfade curve 5 keeps the power curve its intensity gave; an unknown curve is linear", () =>
{
  const linear = CrossFade(() => {});
  const curve5 = CrossFade(modifier => { modifier.crossFadeCurve = 5; });
  assert.deepEqual(curve5, CrossFade(modifier => { modifier.crossFadeIntensity = OLD_INTENSITY; }));
  assert.deepEqual(CrossFade(modifier => { modifier.crossFadeCurve = 3; }), linear);
  assert.notDeepEqual(curve5, linear);
  assert.equal(curve5[0], 1);
  assert.equal(curve5.at(-1), 1);
});

test("activationDelay holds activation as delayedActivation did; no delay does not hold", () =>
{
  const delayed = Activation(modifier => { modifier.activationDelay = 0.5; });
  assert.deepEqual(delayed, Activation(modifier => { modifier.delayedActivation = 0.5; }));
  assert.deepEqual(delayed.slice(0, 5), [ 0, 0, 0, 0, 0 ]);
  assert.ok(delayed.at(-1) > 0);
  const undelayed = Activation(() => {});
  assert.ok(undelayed[0] > 0);
  assert.notDeepEqual(delayed, undelayed);
});

/** Authored minimal Black framing; schema facts come only from runtime declarations. */
class BlackFixture
{
  strings = [];
  String(value)
  {
    let index = this.strings.indexOf(value);
    if (index === -1) { index = this.strings.length; this.strings.push(value); }
    return U16(index);
  }
  Object(id, kind = null, fields = [])
  {
    if (kind === null) return U32(id);
    const parts = [this.String(kind)];
    for (const [name, value] of fields) parts.push(Concat([this.String(name), value]));
    const body = Concat(parts);
    return Concat([U32(id), U32(body.length), body]);
  }
  Finish(root)
  {
    const parts = [U16(this.strings.length)];
    for (const value of this.strings) parts.push(Concat([new TextEncoder().encode(value), new Uint8Array(1)]));
    const strings = Concat(parts), wide = U16(0);
    return Concat([U32(0xb1acf11e), U32(1), U32(strings.length), strings, U32(wide.length), wide, root]);
  }
}
function Concat(parts)
{
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}
function U16(value) { const bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); return bytes; }
function U32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes; }
function F32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setFloat32(0, value, true); return bytes; }
