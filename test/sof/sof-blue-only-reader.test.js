// SOF on Black, Blue and SOF alone: the reader's class library is the injected
// Blue. Only Blue and SOF are imported here, so no Trinity class is registered,
// and a class Blue does not have fails the read.
import assert from "node:assert/strict";
import test from "node:test";
import { blue } from "../../npm/dist/blue/index.js";
import "../../npm/dist/sof/index.js";
import { BlackReader } from "../../npm/dist/blue/formats/black/BlackReader.js";
import { composeStubResMan } from "../support/stubResMan.js";
import { clientResources } from "../support/clientResources.js";

const client = await clientResources();
composeStubResMan(() => null);

test("SOF imported alone registers its classes with Blue and no Trinity class", () =>
{
  assert.notEqual(blue.classes.Get("EveSOFDataHull"), null);
  assert.equal(blue.classes.Get("EveShip2"), null, "nothing here imports Trinity");
  assert.equal(blue.classes.GetInfo("EveSOFDataHull").classId, "EveSOFDataHull");
});

test("a class Blue does not have throws from Blue", () =>
{
  assert.throws(() => blue.classes.GetInfo("EveShip2"), /Blue has no class named EveShip2/);
});

test("Black reads SOF's own data with only Black, Blue and SOF", { skip: client.skip }, async () =>
{
  const reader = new BlackReader();
  const faction = reader.ReadFromStream(await client.Read("res:/dx9/model/spaceobjectfactory/factions/amarrbase.black"));
  assert.ok(faction, reader.GetErrorMessage());
  assert.equal(faction.constructor, blue.classes.Get("EveSOFDataFaction"));
  assert.equal(faction.name, "amarrbase");
});

test("Black fails a file whose class Blue does not have", { skip: client.skip }, async () =>
{
  // A Trinity object: its class is not registered here.
  const reader = new BlackReader();
  const result = reader.ReadFromStream(await client.Read("res:/dx9/model/ship/minmatar/frigate/mf1/effects/mf1_t1_fx_01a.black"));
  assert.equal(result, null);
  assert.match(reader.GetErrorMessage(), /Failed to create an instance of /);
});
