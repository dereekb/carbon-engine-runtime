import assert from "node:assert/strict";
import { test } from "node:test";

import { Tr2GpuParticleSystemNoCompute } from "../../npm/dist/trinity/particle/Tr2GpuParticleSystemNoCompute.js";

const CARBON_DEFAULT = 1048576;

test("Carbon's default capacity gives way to WebGL2's, which is a square", () =>
{
  assert.equal(Tr2GpuParticleSystemNoCompute.widthFor(CARBON_DEFAULT, CARBON_DEFAULT), 512);
});

test("an authored capacity is kept, rounded up to a power-of-two square", () =>
{
  assert.equal(Tr2GpuParticleSystemNoCompute.widthFor(65536, CARBON_DEFAULT), 256);
  assert.equal(Tr2GpuParticleSystemNoCompute.widthFor(65537, CARBON_DEFAULT), 512);
  assert.equal(Tr2GpuParticleSystemNoCompute.widthFor(1, CARBON_DEFAULT), 1);
  assert.equal(Tr2GpuParticleSystemNoCompute.widthFor(0, CARBON_DEFAULT), 1);
});
