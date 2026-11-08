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
