import assert from "node:assert/strict";
import test from "node:test";
import { EveChildTurret, EveTurretFiringFX, Tr2GrannyAnimation, TriGeometryRes } from "../../npm/dist/trinity/index.js";

test("child-turret teardown detaches its surviving updater and stops its firing effect", () =>
{
  const turret = new EveChildTurret(), peer = new EveChildTurret();
  const updater = new Tr2GrannyAnimation(), peerUpdater = new Tr2GrannyAnimation();
  turret._hookedUpdater = updater;
  peer._hookedUpdater = peerUpdater;
  updater.SetPoseModifier(turret);
  peerUpdater.SetPoseModifier(peer);
  const firing = new EveTurretFiringFX();
  turret._firingEffect = firing;
  firing.isFiring = true;
  turret._cachedGeometryRes = new TriGeometryRes();
  turret._firingEffectMuzzlePosSet = true;
  turret._pendingFiringEffectCalls = [() => assert.fail("retired deferred call")];
  const request = turret._firingEffectRequest;
  turret.OnDestruct();
  turret.OnDestruct();
  assert.equal(updater.GetPoseModifier(), null);
  assert.equal(peerUpdater.GetPoseModifier(), peer);
  assert.equal(firing.isFiring, false);
  assert.equal(turret._firingEffect, firing);
  assert.equal(turret._cachedGeometryRes, null);
  assert.equal(turret._firingEffectMuzzlePosSet, false);
  assert.equal(turret._pendingFiringEffectCalls, null);
  assert.ok(turret._firingEffectRequest > request);
  peer.OnDestruct();
});

test("child-turret teardown preserves a replacement modifier on the old updater", () =>
{
  const turret = new EveChildTurret(), replacement = new EveChildTurret();
  const updater = new Tr2GrannyAnimation();
  turret._hookedUpdater = updater;
  updater.SetPoseModifier(replacement);
  turret.OnDestruct();
  turret.OnDestruct();
  assert.equal(updater.GetPoseModifier(), replacement);
});
