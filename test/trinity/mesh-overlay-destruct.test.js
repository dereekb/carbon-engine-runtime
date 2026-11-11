import test from "node:test";
import { EveMeshOverlayEffect } from "../../npm/dist/trinity/index.js";
import { assertControllerDestruct } from "../support/controllerDestruct.js";

test("mesh-overlay teardown unlinks controllers for deletion", () =>
{
  assertControllerDestruct(new EveMeshOverlayEffect());
});
