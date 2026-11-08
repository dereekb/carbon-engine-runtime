import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollTextureRoles } from "../../../npm/dist/character/index.js";

const ROOT = "res:/graphics/character/female/paperdoll/";

test("CjsPaperDollTextureRoles reads region, suffix, tier, property and operation from a file name", () =>
{
  const twist = CjsPaperDollTextureRoles.lookup(ROOT + "makeup/aging/aging_01/comp_head_tn_4k.png");
  assert.deepEqual([ twist.family, twist.region, twist.suffix, twist.tier, twist.property, twist.operation ],
    [ "comp", "head", "tn", "_4k", "NormalMap", "Twist" ]);
  const specular = CjsPaperDollTextureRoles.lookup(ROOT + "makeup/aging/aging_01/comp_body_s.png");
  assert.deepEqual([ specular.region, specular.tier, specular.property, specular.operation, specular.covered ], [ "body", "", "SpecularMap", "Simple", true ]);
  const zones = CjsPaperDollTextureRoles.lookup("colorize_hair_z_512.png");
  assert.deepEqual([ zones.property, zones.operation, zones.inputOf ], [ "DiffuseMap", null, "l" ]);
  assert.equal(CjsPaperDollTextureRoles.lookup("comp_body_m_512.png").property, "CutMaskMap");
  assert.equal(CjsPaperDollTextureRoles.lookup("comp_head_mn.png").operation, "MaskedNormal");
  assert.equal(CjsPaperDollTextureRoles.lookup("colorize_acc_l.png").operation, "Colorized");
});

test("CjsPaperDollTextureRoles cites a source for every role", () =>
{
  for (const [ suffix, role ] of Object.entries(CjsPaperDollTextureRoles.table))
    assert.ok(role.source.length > 20 && role.property && role.channels, suffix);
});

test("CjsPaperDollTextureRoles throws for a name it does not source", () =>
{
  // Unknown suffix, a known suffix under a family it is not sourced for, an unknown region, a non-png, a bare name.
  for (const name of [ "comp_head_q.png", "comp_head_z.png", "colorize_body_n_4k.png", "comp_face_d.png", "comp_head_d_256.dds", "normal_n.png" ])
    assert.throws(() => CjsPaperDollTextureRoles.lookup(name), /paper doll texture/, name);
});
