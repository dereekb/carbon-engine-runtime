import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterAppearanceResolver, CjsPaperDollInstance } from "../../../npm/dist/character/index.js";

const { decodeUtilityShape, resolveUtilityShapes } = CjsCharacterAppearanceResolver;

/** A dependant as its male metadata states it (build 3687575): its path, file and two lists as authored. */
function Dependant(path, dependantModifiers = [], occludesModifiers = [], variation = "")
{
    return { path, metadataPath: "res:/graphics/character/male/paperdoll/" + path + "/" + (variation ? variation + "/" : "") + "metadata.yaml", dependantModifiers, occludesModifiers };
}

const standard = Dependant("dependants/boottucking/standard", [],
    [ "utilityshapes/pinchbootankleshape", "utilityshapes/pinchboothighshinshape", "utilityshapes/pinchbootkneeshape", "utilityshapes/pinchbootlowshinshape" ]);
const standardV1 = Dependant("dependants/boottucking/standard", [],
    [ "utilityshapes/pantstucklowshape", "utilityshapes/pantstuckshinshape", "utilityshapes/pantstuckmediumshape", "utilityshapes/pantstuckkneeshape", "utilityshapes/pantstuckhighshape", "utilityshapes/pantstuckxhighshape" ], "v1");

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

test("boot-tucking requests carry no owner, and occlusions protect none", () =>
{
    const shin = Dependant("dependants/boottucking/shin", [ "utilityshapes/pantstuckshinshape" ]);
    const shapes = CjsPaperDollInstance.dependantShapes([ shin, standard, Dependant("dependants/drape/loose") ]);
    assert.deepEqual(shapes.requests, [ decodeUtilityShape("utilityshapes/pantstuckshinshape") ]);
    assert.deepEqual(shapes.occlusions.map(value => [ value.modifierPath, value.protectedOwner ]),
        standard.occludesModifiers.map(value => [ value, null ]));
});

test("every dependant entry without a rule throws, naming its kind, entry and file", () =>
{
    const missing = (dependant, pattern) => assert.throws(() => CjsPaperDollInstance.dependantShapes([ standard, dependant ]), pattern);
    // Kinds with no rule yet: drape and waist tucking (weighted occlusions), the hood (a part occlusion).
    missing(Dependant("dependants/drape/outer", [ "utilityshapes/pinchhipsshape" ]),
        /^Error: No paper doll rule for the dependants\/drape dependantModifiers entry utilityshapes\/pinchhipsshape in res:\/graphics\/character\/male\/paperdoll\/dependants\/drape\/outer\/metadata\.yaml$/u);
    missing(Dependant("dependants/drape/standard", [], [ "utilityshapes/pinchhipsshape#0.01" ]), /dependants\/drape occludesModifiers entry utilityshapes\/pinchhipsshape#0\.01/u);
    missing(Dependant("dependants/waisttucking/standard", [], [ "dependants/tuck" ]), /dependants\/waisttucking occludesModifiers entry dependants\/tuck/u);
    missing(Dependant("dependants/hood/robeam1", [], [ "hair" ], "v1"), /dependants\/hood occludesModifiers entry hair in .*robeam1\/v1\/metadata\.yaml/u);
    // Within boot tucking, an entry naming no utility shape (female standard/v1).
    missing(Dependant("dependants/boottucking/standard", [], [ "dependants/bootmasks" ], "v1"), /dependants\/boottucking occludesModifiers entry dependants\/bootmasks/u);
    // A folder that only starts with the same letters is not boot tucking.
    missing(Dependant("dependants/boottuckingx", [ "utilityshapes/pantstuckshinshape" ]), /dependants\/boottuckingx dependantModifiers/u);
});

test("a worn item's own utility shapes decode, and a weighted occlusion throws", () =>
{
    const item = (dependantModifiers, occludesModifiers) => ({ metadataPath: "res:/graphics/character/female/paperdoll/topmiddle/x/metadata.yaml", dependantModifiers, occludesModifiers });
    const shapes = CjsPaperDollInstance.itemShapes(item([ "utilityshapes/pushhemmidshape###0.35", "dependants/drape/standard" ], [ "utilityshapes/tucktopshape", "dependants/tuck", "hair" ]));
    assert.deepEqual(shapes.requests, [ decodeUtilityShape("utilityshapes/pushhemmidshape###0.35") ]);
    assert.deepEqual(shapes.occlusions.map(value => value.modifierPath), [ "utilityshapes/tucktopshape" ]);
    assert.throws(() => CjsPaperDollInstance.itemShapes(item([], [ "utilityshapes/pinchrighthipsshape#2.0" ])),
        /^Error: No paper doll rule for the occludesModifiers entry utilityshapes\/pinchrighthipsshape#2\.0 in res:\/graphics\/character\/female\/paperdoll\/topmiddle\/x\/metadata\.yaml$/u);
});
