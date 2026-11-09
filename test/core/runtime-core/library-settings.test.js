import assert from "node:assert/strict";
import test from "node:test";
import { BlueOS } from "../../../npm/dist/blue/index.js";
import { CjsLibrary } from "../../../npm/dist/core/CjsLibrary.js";
import { Tr2Renderer } from "../../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub } from "../../../npm/dist/trinityal/index.js";
// Registers the backend-categorised settings (webgpuMaxBufferSize, webgl2LightAveraging).
import "../../../npm/dist/core/platform/Tr2PlatformInfo.js";

/** An audio manager with CjsAudioMan's enable surface and a counter of each call. */
function FakeAudio({ library = {}, enable = () => true } = {})
{
  const audio = { library, system: { manager: { enabled: false } }, calls: [] };
  audio.Enable = () => { audio.calls.push("Enable"); const ok = enable(); audio.system.manager.enabled = ok; return ok; };
  audio.Disable = () => { audio.calls.push("Disable"); audio.system.manager.enabled = false; };
  return audio;
}

/** Fakes a browser realm: Web Audio present, and the page's sticky activation. */
function FakeBrowser(t, { webAudio = true, activated = false } = {})
{
  const saved = { AudioContext: globalThis.AudioContext, navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator") };
  globalThis.AudioContext = webAudio ? class {} : undefined;
  const navigator = { userActivation: { hasBeenActive: activated } };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
  t.after(() =>
  {
    globalThis.AudioContext = saved.AudioContext;
    if (saved.navigator) Object.defineProperty(globalThis, "navigator", saved.navigator);
    else delete globalThis.navigator;
    CjsLibrary.audioEnabled = false;
  });
  return navigator;
}

test("newBloom is unavailable and held off, whatever is requested or written", async t =>
{
  const library = new CjsLibrary({ settings: { newBloom: true } });
  t.after(() => library.Shutdown());
  await library.Initialize({ os: new BlueOS() });
  const settings = Tr2Renderer.getSettings();
  assert.deepEqual(library.GetSettingAvailability("newBloom"), { available: false, reason: "Not fully supported in Carbon" });
  assert.equal(settings.GetValue("newBloom"), false);
  assert.equal(library.GetConfiguration().requested.settings.newBloom, true);
  settings.SetValue("newBloom", true);
  library._settingsTicker.OnTick(0, 0, null);
  assert.equal(settings.GetValue("newBloom"), false);
});

test("audioEnabled is off by default and unavailable until an audio manager is attached with Web Audio", async t =>
{
  FakeBrowser(t, { webAudio: false });
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  assert.equal(Tr2Renderer.getSettings().GetValue("audioEnabled"), false);
  assert.deepEqual(library.GetSettingAvailability("audioEnabled"), { available: false, reason: "Web Audio is not supported in this browser" });
  globalThis.AudioContext = class {};
  assert.equal(library.GetSettingAvailability("audioEnabled").reason, "No audio engine is attached");
  library.AttachAudio(FakeAudio());
  assert.deepEqual(library.GetSettingAvailability("audioEnabled"), { available: true, reason: null });
  library.DetachAudio();
  assert.equal(library.GetSettingAvailability("audioEnabled").available, false);
});

test("a saved 'on' starts audio at the first gesture, not before; 'off' stops it", async t =>
{
  const navigator = FakeBrowser(t);
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  const audio = library.AttachAudio(FakeAudio());
  Tr2Renderer.getSettings().SetValue("audioEnabled", true);

  library._ApplySettingsPolicy(false);
  assert.deepEqual(audio.calls, [], "no gesture yet");
  library._ApplySettingsPolicy(true);
  assert.deepEqual(audio.calls, [ "Enable" ]);

  Tr2Renderer.getSettings().SetValue("audioEnabled", false);
  library._ApplySettingsPolicy(false);
  assert.deepEqual(audio.calls, [ "Enable", "Disable" ]);

  // Switched on later, after the page has had a gesture: the next tick starts it.
  navigator.userActivation.hasBeenActive = true;
  Tr2Renderer.getSettings().SetValue("audioEnabled", true);
  library._ApplySettingsPolicy(false);
  assert.deepEqual(audio.calls, [ "Enable", "Disable", "Enable" ]);
});

test("audio waits for the application's library, and a failed enable is reported once until switched off", async t =>
{
  FakeBrowser(t, { activated: true });
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  const audio = library.AttachAudio(FakeAudio({ library: null, enable: () => { throw new Error("no device"); } }));
  Tr2Renderer.getSettings().SetValue("audioEnabled", true);
  library._ApplySettingsPolicy(false);
  assert.deepEqual(audio.calls, [], "no library installed yet");
  audio.library = {};
  library._ApplySettingsPolicy(false);
  library._ApplySettingsPolicy(true);
  assert.deepEqual(audio.calls, [ "Enable" ]);
  assert.equal(library.GetAudioState().failure, "no device");
  Tr2Renderer.getSettings().SetValue("audioEnabled", false);
  library._ApplySettingsPolicy(false);
  assert.equal(library.GetAudioState().failure, null);
});

test("the other backend's settings are unavailable once a backend is attached", async t =>
{
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  await library.Initialize({ os: new BlueOS() });
  assert.equal(library.GetSettingAvailability("webgpuMaxBufferSize").available, true, "no backend yet");
  assert.throws(() => library.AttachTrinity({ renderContextAL: new Tr2RenderContextALStub(), backend: "metal" }), RangeError);
  library.AttachTrinity({ renderContextAL: new Tr2RenderContextALStub(), backend: "webgl2" });
  assert.deepEqual(library.GetSettingAvailability("webgpuMaxBufferSize"), { available: false, reason: "WebGPU only" });
  assert.equal(library.GetSettingAvailability("webgl2LightAveraging").available, true);
  assert.equal(library.GetSettingAvailability("eveSpaceSceneDynamicLighting").available, true);
});
