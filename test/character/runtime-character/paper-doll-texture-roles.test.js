import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterTextureRoles } from "../../../npm/dist/character/index.js";

const ROOT = "res:/graphics/character/female/paperdoll/";

test("CjsCharacterTextureRoles reads region, suffix, tier, property and operation from a file name", () =>
{
  const twist = CjsCharacterTextureRoles.lookup(ROOT + "makeup/aging/aging_01/comp_head_tn_4k.png");
  assert.deepEqual([ twist.family, twist.region, twist.suffix, twist.tier, twist.property, twist.operation ],
    [ "comp", "head", "tn", "_4k", "NormalMap", "Twist" ]);
  const specular = CjsCharacterTextureRoles.lookup(ROOT + "makeup/aging/aging_01/comp_body_s.png");
  assert.deepEqual([ specular.region, specular.tier, specular.property, specular.operation, specular.covered ], [ "body", "", "SpecularMap", "Simple", true ]);
  const zones = CjsCharacterTextureRoles.lookup("colorize_hair_z_512.png");
  assert.deepEqual([ zones.property, zones.operation, zones.inputOf ], [ "DiffuseMap", null, "l" ]);
  assert.equal(CjsCharacterTextureRoles.lookup("comp_body_m_512.png").property, "CutMaskMap");
  assert.equal(CjsCharacterTextureRoles.lookup("comp_head_mn.png").operation, "MaskedNormal");
  assert.equal(CjsCharacterTextureRoles.lookup("colorize_acc_l.png").operation, "Colorized");
  // A family's own role: the tattoo zone is an input of the bake, not of an `l` map.
  const tattoo = CjsCharacterTextureRoles.lookup(ROOT + "tattoo/head/tattoofacea01/comp_head_z.png");
  assert.deepEqual([ tattoo.family, tattoo.suffix, tattoo.operation, tattoo.inputOf ], [ "comp", "z", null, null ]);
  assert.match(tattoo.derived, /5a7e30d/);
});

test("CjsCharacterTextureRoles cites a source for every role", () =>
{
  for (const [ suffix, role ] of Object.entries(CjsCharacterTextureRoles.table))
    assert.ok(role.source.length > 20 && role.property && role.channels, suffix);
});

test("CjsCharacterTextureRoles throws for a name it does not source", () =>
{
  // Unknown suffix, a known suffix under a family it is not sourced for, an unknown region, a non-png, a bare name.
  for (const name of [ "comp_head_q.png", "colorize_head_tn.png", "colorize_body_n_4k.png", "comp_face_d.png", "comp_head_d_256.dds", "normal_n.png" ])
    assert.throws(() => CjsCharacterTextureRoles.lookup(name), /paper doll texture/, name);
});
