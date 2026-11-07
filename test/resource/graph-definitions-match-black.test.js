import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { VARTYPE } from "../../npm/dist/global/model/graph/index.js";
import { blue } from "../../npm/dist/blue/index.js";
import { CjsBlueGraph } from "../../npm/dist/blue/formats/graph/index.js";
import { CjsGraph } from "../../npm/dist/global/model/graph/index.js";
import { getClassRegistrations } from "../../npm/dist/blue/exposure/classes/registry.js";
import { ImportAllDistModules } from "../support/allDistClasses.js";

await ImportAllDistModules();
CjsBlueGraph.register(blue.classes);

// Step 7's adapter reaches dist only once the Black port is an entry point.
const adapter = new URL("../../npm/dist/blue/formats/black/CjsBlackDefinitions.js", import.meta.url);
const { BLACK_DESTINATION, CjsBlackDefinitions } = existsSync(adapter) ? await import(adapter) : {};

const DESTINATIONS = BLACK_DESTINATION && {
  [BLACK_DESTINATION.LIST]: "list", [BLACK_DESTINATION.ARRAY]: "array", [BLACK_DESTINATION.SET]: "set",
  [BLACK_DESTINATION.DICT]: "dict", [BLACK_DESTINATION.STRUCTURELIST]: "structureList", [BLACK_DESTINATION.WRAPPER]: "wrapper"
};

/** What Black's adapter says, in the compiled definition's terms. */
function expected(entry)
{
  return {
    vartype: entry.type,
    length: entry.floatArraySize,
    wrapper: entry.wrapperClass,
    destination: DESTINATIONS[entry.destination] ?? null
  };
}

/** What the compiled definition says, for the same comparison. */
function compiled(member)
{
  const object = member.edgeKind === "embed" && member.collection === null;

  return {
    vartype: member.vartype,
    length: member.vartype === VARTYPE.FLOATARRAY ? member.length : 0,
    wrapper: member.wrapped === null ? null : member.wrapped.wireClass,
    destination: object ? null : member.collection === "array" || member.collection === "set" ? member.collection : member.destination
  };
}

test("every persisted member compiles to what Black's adapter says it is", { skip: !CjsBlackDefinitions && "The Black port is not in dist." }, () =>
{
  const differences = [];
  let compared = 0;

  for (const { name, type } of getClassRegistrations())
  {
    const entries = CjsBlackDefinitions.get(type).entries;
    const members = CjsGraph.getClassInfo(type).compiled.persistByName;

    for (const [ member, entry ] of entries)
    {
      // A derived row with no PERSIST hides the base's: the adapter keeps one row per name.
      if (name === "EveSmartLightAttributeModifierControllerVariableListener" && member === "active") continue;

      const definition = members[member];
      if (!definition)
      {
        differences.push(`${name}.${member}: no compiled member`);
        continue;
      }

      // Our own character classes never reach Black, and their Maps of leaf values are not built.
      if (name.startsWith("CjsCharacter")) continue;

      compared++;
      const want = expected(entry), got = compiled(definition);
      if (JSON.stringify(want) !== JSON.stringify(got)) differences.push(`${name}.${member}: ${JSON.stringify(want)} / ${JSON.stringify(got)}`);
    }
  }

  assert.ok(compared > 4000, `compared ${compared}`);
  assert.deepEqual(differences.slice(0, 40), [], `${differences.length} of ${compared} differ`);
});
