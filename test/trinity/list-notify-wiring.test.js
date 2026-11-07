import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueList } from "../../npm/dist/blue/exposure/BlueList.js";
import "../../npm/dist/trinity/index.js";
import { EveProceduralMethodCycling } from "../../npm/dist/trinity/eve/child/procedural/selection/EveProceduralMethodCycling.js";
import { EveProceduralMethodRandom } from "../../npm/dist/trinity/eve/child/procedural/selection/EveProceduralMethodRandom.js";
import { EveProceduralMethodThresholds } from "../../npm/dist/trinity/eve/child/procedural/selection/EveProceduralMethodThresholds.js";

import { EveBaseDistributionMethod } from "../../npm/dist/trinity/eve/distribution/EveBaseDistributionMethod.js";

import { EveChildBehaviorSystem } from "../../npm/dist/trinity/eve/child/EveChildBehaviorSystem.js";
import { FollowASpline } from "../../npm/dist/trinity/eve/child/behaviors/FollowASpline.js";
import { ProcessLifetime } from "../../npm/dist/trinity/eve/child/behaviors/lifecycle/ProcessLifetime.js";
import { SplineTunnelGroup } from "../../npm/dist/trinity/eve/child/behaviors/tunnels/SplineTunnelGroup.js";

import { EveEllipseSet } from "../../npm/dist/trinity/eve/ui/EveEllipseSet.js";
import { EveLineChildContainer } from "../../npm/dist/trinity/eve/child/lineSetPaths/EveLineChildContainer.js";
import { EveChildInstanceContainer } from "../../npm/dist/trinity/eve/child/EveChildInstanceContainer.js";

import { EveChildSmartLightSet } from "../../npm/dist/trinity/eve/smartLights/EveChildSmartLightSet.js";
import { EveSmartLightBaseGroup } from "../../npm/dist/trinity/eve/smartLights/EveSmartLightBaseGroup.js";
import { EveSmartLightColorShareGroup } from "../../npm/dist/trinity/eve/smartLights/EveSmartLightColorShareGroup.js";
import { EveSmartLightMesh } from "../../npm/dist/trinity/eve/smartLights/EveSmartLightMesh.js";
import { EveSmartLightPointLight } from "../../npm/dist/trinity/eve/smartLights/EveSmartLightPointLight.js";
import { EveSmartLightQuad } from "../../npm/dist/trinity/eve/smartLights/EveSmartLightQuad.js";

// Carbon calls SetNotify per member, in each owner's constructor. Keep one row per member.
const WIRED = [
  [ EveBaseDistributionMethod, [ "placementGenerators", "spawnTriggers", "lifetimeModifiers" ] ],
  [ EveChildBehaviorSystem, [ "behaviorGroups", "splineTunnels" ] ],
  [ FollowASpline, [ "splineTunnels" ] ],
  [ ProcessLifetime, [ "splineTunnels" ] ],
  [ SplineTunnelGroup, [ "curveSets" ] ],
  [ EveEllipseSet, [ "ellipses" ] ],
  [ EveLineChildContainer, [ "lines" ] ],
  [ EveChildInstanceContainer, [ "transformModifiers" ] ],
  [ EveChildSmartLightSet, [ "lightGroups" ] ],
  [ EveSmartLightBaseGroup, [ "attributeModifiers" ] ],
  [ EveSmartLightColorShareGroup, [ "attributeModifiers", "lightGroups" ] ],
  [ EveSmartLightMesh, [ "attributeModifiers" ] ],
  [ EveSmartLightPointLight, [ "attributeModifiers" ] ],
  [ EveSmartLightQuad, [ "attributeModifiers" ] ],
  [ EveProceduralMethodCycling, [ "parameters" ] ],
  [ EveProceduralMethodRandom, [ "parameters" ] ],
  [ EveProceduralMethodThresholds, [ "parameters" ] ]
];

for (const [ Owner, members ] of WIRED)
{
  for (const member of members)
  {
    test(`${Owner.className ?? Owner.name}.${member} notifies its owner`, () =>
    {
      const owner = new Owner();
      assert.ok(owner[member] instanceof BlueList);
      const info = {};
      owner[member].GetInfo(info);
      assert.equal(info.notify, owner);
    });
  }
}
