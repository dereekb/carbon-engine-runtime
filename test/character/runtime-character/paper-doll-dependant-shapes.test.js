import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterAppearanceResolver, CjsPaperDollInstance } from "../../../npm/dist/character/index.js";

const { decodeUtilityShape, decodeUtilityOcclusion, resolveUtilityShapes } = CjsCharacterAppearanceResolver;

/** A dependant as its male metadata states it (build 3687575): its path, requests and occlusions, decoded. */
function Dependant(path, requests = [], occlusions = [])
{
    return { path, requests: requests.map(value => decodeUtilityShape(value)), occlusions: occlusions.map(value => decodeUtilityOcclusion(value)) };
}

const standard = Dependant("dependants/boottucking/standard", [],
    [ "utilityshapes/pinchbootankleshape", "utilityshapes/pinchboothighshinshape", "utilityshapes/pinchbootkneeshape", "utilityshapes/pinchbootlowshinshape" ]);
const standardV1 = Dependant("dependants/boottucking/standard", [],
    [ "utilityshapes/pantstucklowshape", "utilityshapes/pantstuckshinshape", "utilityshapes/pantstuckmediumshape", "utilityshapes/pantstuckkneeshape", "utilityshapes/pantstuckhighshape", "utilityshapes/pantstuckxhighshape" ]);

/** The trousers (pantscm01: pinch request, `standard` dependant) and boots worn together, resolved; retained weights by path. */
function Fit(dependant, bootRequest)
{
    const shapes = CjsPaperDollInstance.dependantShapes([ dependant ]);
    const requests = [
        { ...decodeUtilityShape("utilityshapes/pinchbootankleshape"), owner: "bottomOuter" },
        ...shapes.requests.map(value => ({ ...value, owner: "bottomOuter" })),
        { ...decodeUtilityShape(bootRequest), owner: "feet" }
    ];
    return Object.fromEntries(resolveUtilityShapes(requests, shapes.occlusions).map(group => [ group.modifierPath, group.retained.map(value => value.weight) ]));
}

test("boot tucking standard suppresses its own garment's boot pinch, keeping the boots' trouser tuck", () =>
{
    // Civire (bootscm01).
    assert.deepEqual(Fit(standard, "utilityshapes/pantstuckshinshape"),
        { "utilityshapes/pinchbootankleshape": [], "utilityshapes/pantstuckshinshape": [ 1 ] });
    // Amarr (bootsam01).
    assert.deepEqual(Fit(standard, "utilityshapes/pantstuckmediumshape"),
        { "utilityshapes/pinchbootankleshape": [], "utilityshapes/pantstuckmediumshape": [ 1 ] });
});

test("boot tucking standard/v1 runs the other way: the boots' trouser tuck goes, the pinch stays", () =>
{
    assert.deepEqual(Fit(standardV1, "utilityshapes/pantstuckshinshape"),
        { "utilityshapes/pinchbootankleshape": [ 1 ], "utilityshapes/pantstuckshinshape": [] });
});

test("only boot-tucking dependants add shapes, and their requests carry no owner", () =>
{
    const shin = Dependant("dependants/boottucking/shin", [ "utilityshapes/pantstuckshinshape" ]);
    const drape = Dependant("dependants/drape/outer", [ "utilityshapes/pinchhipsshape" ]);
    const waist = Dependant("dependants/waisttucking/standard", [], [ "utilityshapes/pinchtuckshape" ]);
    const shapes = CjsPaperDollInstance.dependantShapes([ shin, drape, waist, standard ]);
    assert.deepEqual(shapes.requests, [ shin.requests[0] ]);
    assert.notEqual(shapes.requests[0], shin.requests[0]);
    assert.deepEqual(shapes.occlusions.map(value => [ value.modifierPath, value.protectedOwner ]),
        standard.occlusions.map(value => [ value.modifierPath, null ]));
    // A folder that only starts with the same letters is not below it.
    assert.deepEqual(CjsPaperDollInstance.dependantShapes([ Dependant("dependants/boottuckingx", [ "utilityshapes/pantstuckshinshape" ]) ]).requests, []);
});
