// Red objects load through YamlReader, Carbon's reader on the same stream base as
// BlackReader: a member type reads as it does in Black, and each class comes from
// Blue's class registry. Red has no payload output; export an object's values
// separately with the Blue values service.
export { CjsRedFormat } from "./CjsRedFormat.js";
