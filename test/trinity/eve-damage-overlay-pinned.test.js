// Pinned armour impacts: ours, not Carbon's. scene-director paints EVE's armour damage into its hull craters through
// EveDamageOverlay.SetPinnedImpacts; these rows draw after the live impacts, never heal and stay out of the impact
// table, Clear and SetDamageState.
import test from "node:test";
import assert from "node:assert/strict";
import { vec3 } from "../../npm/dist/global/math/vec3.js";
import { EveDamageOverlay, EveDamageOverlayOwnerInfo, EveUpdateContext } from "../../npm/dist/trinity/index.js";

const SECOND = 10_000_000;

function OwnerInfo(locators = true)
{
  const info = new EveDamageOverlayOwnerInfo();
  info.boundingSphere[3] = 20;
  info.estimatedPixelDiameter = 64;
  info.isInFrustum = true;
  if (locators)
  {
    info.getDamageLocatorPositionOS = (index, out) =>
    {
      vec3.set(out, index, index, index);
      return true;
    };
  }
  else
  {
    info.getDamageLocatorPositionOS = null;
  }
  return info;
}

function Context(seconds = 1)
{
  const context = new EveUpdateContext();
  context.SetTime(SECOND);
  context.SetTime(SECOND + seconds * SECOND);
  return context;
}

function Row(overlay, index)
{
  const texel = overlay.TexelRow(index);
  return [ Array.from(texel[2]), Array.from(texel[3]) ];
}

test("pinned impacts write rows after the live ones and count in the header", () =>
{
  const overlay = new EveDamageOverlay();
  overlay.SetDamageLocatorCount(8);
  overlay.SetPinnedImpacts([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
  assert.equal(overlay.GetPinnedImpactCount(), 2);

  overlay.UpdateAsyncronous(Context(), OwnerInfo(), 0, false);
  assert.equal(overlay.HeaderRow()[2][0], 2);
  assert.deepEqual(Row(overlay, 0), [ [ 1, 2, 3, 0 ], [ 4, 0, 0, 0 ] ]);
  assert.deepEqual(Row(overlay, 1), [ [ 5, 6, 7, 0 ], [ 8, 0, 0, 0 ] ]);

  overlay.CreateImpact(1, 1);
  overlay.CreateImpact(2, 1);
  overlay.CreateImpact(3, 1);
  overlay.SetDamageState(1, 0.1, 1);
  overlay.UpdateAsyncronous(Context(), OwnerInfo(), 0, false);
  assert.equal(overlay.HeaderRow()[2][0], 5);
  assert.equal(overlay._texelRows.length, 5);
  assert.deepEqual(Row(overlay, 0)[0], [ 1, 1, 1, 0 ]);
  assert.deepEqual(Row(overlay, 2)[0], [ 3, 3, 3, 0 ]);
  assert.deepEqual(Row(overlay, 3), [ [ 1, 2, 3, 0 ], [ 4, 0, 0, 0 ] ]);
  assert.deepEqual(Row(overlay, 4), [ [ 5, 6, 7, 0 ], [ 8, 0, 0, 0 ] ]);
});

test("more shield rows than armour rows keep the shield's row count", () =>
{
  const overlay = new EveDamageOverlay();
  overlay.SetPinnedImpacts([ 1, 2, 3, 4 ]);
  overlay.UpdateAsyncronous(Context(), OwnerInfo(), 6, false);
  assert.equal(overlay._texelRows.length, 6);
  assert.equal(overlay.HeaderRow()[2][0], 1);
  assert.deepEqual(Row(overlay, 0), [ [ 1, 2, 3, 0 ], [ 4, 0, 0, 0 ] ]);
});

test("pinned impacts never heal and survive Clear and SetDamageState", () =>
{
  const overlay = new EveDamageOverlay();
  overlay.SetDamageLocatorCount(4);
  overlay.SetPinnedImpacts([ 1, 2, 3, 4 ]);
  overlay.CreateImpact(0, 0.05);
  overlay.SetDamageState(1, 1, 1);
  assert.equal(overlay.GetArmorImpactGoalCount(), 0);
  for (let frame = 0; frame < 4; frame++) overlay.UpdateAsyncronous(Context(30), OwnerInfo(), 0, false);
  assert.equal(overlay.ArmorImpacts().size, 0, "the live impact healed at goal 0");
  assert.equal(overlay.GetPinnedImpactCount(), 1);
  assert.equal(overlay.HeaderRow()[2][0], 1);

  overlay.Clear();
  overlay.SetDamageState(0, 0.2, 1, true);
  assert.equal(overlay.GetPinnedImpactCount(), 1);
  assert.equal(overlay.HasImpact(0), false);
  for (const impact of overlay.ArmorImpacts().values()) assert.notEqual(impact.size, 4);

  overlay.SetPinnedImpacts(null);
  assert.equal(overlay.GetPinnedImpactCount(), 0);
  overlay.SetPinnedImpacts([]);
  assert.equal(overlay.GetPinnedImpactCount(), 0);
  overlay.SetPinnedImpacts([ 1, 2, 3, 4, 5 ]);
  assert.equal(overlay.GetPinnedImpactCount(), 1, "a trailing partial entry is dropped");
});

test("pinned rows are written without a locator source", () =>
{
  const overlay = new EveDamageOverlay();
  overlay.SetPinnedImpacts([ 9, 8, 7, 6 ]);
  overlay.UpdateAsyncronous(Context(), OwnerInfo(false), 0, false);
  assert.deepEqual(Row(overlay, 0), [ [ 9, 8, 7, 0 ], [ 6, 0, 0, 0 ] ]);
});

test("pinned impacts keep the armour pass active and stay out of the impact table", () =>
{
  const overlay = new EveDamageOverlay();
  assert.equal(overlay.HasArmorActivity(), false);
  const source = new Float32Array([ 1, 2, 3, 4 ]);
  overlay.SetPinnedImpacts(source);
  source[0] = 99;
  assert.equal(overlay.HasArmorActivity(), true);
  assert.equal(overlay.HasGeneralActivity(), true);
  assert.equal(overlay.ArmorImpacts().size, 0);
  overlay.UpdateAsyncronous(Context(), OwnerInfo(), 0, false);
  assert.deepEqual(Row(overlay, 0)[0], [ 1, 2, 3, 0 ], "the input is copied");

  overlay.SetDamageLocatorCount(4);
  const index = overlay.CreateImpact(1, 0.5);
  assert.equal(overlay.ArmorImpacts().size, 1);
  assert.equal(overlay.ArmorImpacts().get(index).damageLocatorIndex, 1);

  EveDamageOverlay.impactEffectEnabled = false;
  try
  {
    assert.equal(overlay.HasArmorActivity(), false);
  }
  finally
  {
    EveDamageOverlay.impactEffectEnabled = true;
  }
});
