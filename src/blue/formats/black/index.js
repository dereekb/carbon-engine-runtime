// Black objects load through BlackReader, Carbon's reader on its stream base
// (IRootReaderBase): ResMan's object builder hands it the bytes, and it asks only
// Blue's class registry (blue.classes) for each class, so a class Blue lacks fails
// the read. CjsBlackFormat's payload and json outputs, which SOF's catalog ingest
// and tools read as plain data, still come from the older reader in core/ until
// SOF ingests runtime objects.
export { CjsBlackFormat } from "./CjsBlackFormat.js";
