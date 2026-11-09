# Dropped Blue readers

Files here are kept as the record of a replaced implementation. They are not
imported, exported or bundled, and are not part of the package API.

## YamlReader

The Red reader before step 7 of the Blue plan. It read members through the
values-shaped `blue/format/IRootReaderBase` (`_ReadMember`, one switch on the
declared kind) and asked the schema for classes.

It was replaced on 2026-11-08 by `blue/formats/yaml/YamlReader.js`. The new
reader is Carbon's `YamlReader` on Carbon's stream base
(`blue/formats/black/IRootReaderBase.js`), the base `BlackReader` stands on.
Each member is read by the handler for its VARTYPE, so a type reads as it does
in Black, and each class comes from Blue's class registry.

The two readers were compared on every file of the client's Black corpus,
written to Red with `YamlWriter`. Both read them alike apart from the
differences already ruled, and the new reader failed no file the old one read.

Importing this file beside the live reader registers `YamlReader` twice, and
the second registration is refused. Revive it only to compare against it.

Replacement surface:

- `src/blue/formats/yaml/YamlReader.js`

## The plain-data Black reader (`black/`)

`black/core/` (CjsBlackReader with its property readers, schema registry and
binary cursor), its base `black/CjsBlueReader.js`, and the `CjsBlackFormat` that
drove them. The reader decoded `.black` either into runtime objects or into
neutral plain data without building objects. Each class's layout came from the
schema, through source shapes and a registry of its own. It had options for
payload field names, output classes and unknown fields.

It was replaced on 2026-11-08:

- Every Black read now goes through `blue/formats/black/BlackReader.js`.
  BlackReader is Carbon's reader: it builds the registered Blue classes the file
  names, asks only Blue's class registry for them, and reads each member through
  its class's `ClassInfo`.
- `CjsBlackFormat`'s payload and json outputs are now the read objects' values
  (`GetValues` with `refs` and `typeTags`). Its `inspect` reports BlackReader's
  header and string tables.
- SOF's catalog arrives as the `EveSOFData` objects resMan builds, as Carbon's
  `EveSOFDataMgr::LoadData` takes it from `BeResMan->LoadObject`.

The plain data this reader made wrote a shared object as `{ _ref }`, and SOF's
projections did not resolve it, so 333 plane set items of the catalog projected
as defaults. The objects carry the shared object itself.

The tests of this reader's own internals are kept beside it in `black/test/`.
They are not run.

Replacement surfaces:

- `src/blue/formats/black/BlackReader.js`
- `src/blue/formats/black/CjsBlackFormat.js`
