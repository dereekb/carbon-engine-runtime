import test from "node:test";
import assert from "node:assert/strict";
import { CjsWebAudioSoundEngine } from "../../../npm/dist/audio/index.js";
import { FakeDynamicsCompressor } from "../../support/webAudioNodes.js";

// The backend's arbiter for EVE's authored Wwise playback limits (SFX graph v3
// `voiceLimits`, `priority`, `virtualVoice`): per-object, global and bus
// counters, the loser choice by priority and tie rule, 50 ms kills, virtual
// voices on plain voices, the host's exempt object and the report.
// FakeParam and FakeContext are copied from audio-backend-isolation.test.js.

function FakeParam(initial)
{
  const param = {
    value: initial,
    ramps: [],
    curves: [],
    cancellations: [],
    sets: [],
    targets: [],
    cancelScheduledValues(time)
    {
      param.cancellations.push(time);
    },
    setValueAtTime(value, time)
    {
      param.sets.push([value, time]);
      param.value = value;
    },
    linearRampToValueAtTime(value, time)
    {
      param.ramps.push([value, time]);
    },
    setTargetAtTime(value, time, timeConstant)
    {
      param.targets.push([value, time, timeConstant]);
    },
    setValueCurveAtTime(values, time, duration)
    {
      param.curves.push([ Array.from(values), time, duration ]);
    }
  };
  return param;
}

function FakeContext()
{
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination: { name: "destination" },
    listener: {
      positionX: FakeParam(0), positionY: FakeParam(0), positionZ: FakeParam(0),
      forwardX: FakeParam(0), forwardY: FakeParam(0), forwardZ: FakeParam(-1),
      upX: FakeParam(0), upY: FakeParam(1), upZ: FakeParam(0),
    },
    gains: [],
    filters: [],
    panners: [],
    analysers: [],
    sources: [],
    oscillators: [],
    waveShapers: [],
    createDynamicsCompressor: FakeDynamicsCompressor,
    createGain()
    {
      const node = {
        gain: FakeParam(1),
        connectedTo: null,
        connections: [],
        disconnected: false,
        connect(target)
        {
          node.connectedTo = target;
          node.connections.push(target);
        },
        disconnect()
        {
          node.disconnected = true;
        }
      };
      context.gains.push(node);
      return node;
    },
    createPanner()
    {
      const node = {
        panningModel: "", distanceModel: "", refDistance: 1,
        positionX: FakeParam(0), positionY: FakeParam(0), positionZ: FakeParam(0),
        connectedTo: null,
        disconnected: false,
        connect(target)
        {
          node.connectedTo = target;
        },
        disconnect: () =>
        {
          node.disconnected = true;
        }
      };
      context.panners.push(node);
      return node;
    },
    createBiquadFilter()
    {
      const node = {
        type: "",
        frequency: FakeParam(0),
        Q: FakeParam(1),
        gain: FakeParam(0),
        connectedTo: null,
        disconnected: false,
        connect(target)
        {
          node.connectedTo = target;
        },
        disconnect()
        {
          node.disconnected = true;
        },
      };
      context.filters.push(node);
      return node;
    },
    createBufferSource()
    {
      const source = {
        disconnect() {},
        buffer: null, loop: false, onended: null, started: false, stoppedAt: null,
        connectedTo: null, playbackRate: FakeParam(1),
        connect(target)
        {
          source.connectedTo = target;
        },
        start(time, offset)
        {
          source.observedNow = context.currentTime;
          source.started = true;
          source.startedAt = time;
          source.offset = offset;
        },
        stop(time)
        {
          source.stoppedAt = time ?? context.currentTime;
        }
      };
      context.sources.push(source);
      return source;
    },
    createOscillator()
    {
      const oscillator = {
        type: "",
        frequency: FakeParam(0),
        connectedTo: null,
        starts: [],
        stops: [],
        disconnected: false,
        connect(target) { oscillator.connectedTo = target; },
        start(at) { oscillator.starts.push(at); },
        stop(at) { oscillator.stops.push(at); },
        disconnect() { oscillator.disconnected = true; },
      };

      context.oscillators.push(oscillator);
      return oscillator;
    },
    createWaveShaper()
    {
      const shaper = {
        curve: null,
        oversample: "none",
        connectedTo: null,
        disconnected: false,
        connect(target) { shaper.connectedTo = target; },
        disconnect() { shaper.disconnected = true; },
      };

      context.waveShapers.push(shaper);
      return shaper;
    }
  };
  context.createAnalyser = () =>
  {
    const analyser = {
      fftSize: 0,
      connectedTo: null,
      disconnected: false,
      sampleValue: 0.25,
      connect(target)
      {
        analyser.connectedTo = target;
      },
      disconnect()
      {
        analyser.disconnected = true;
      },
      getFloatTimeDomainData(samples)
      {
        samples.fill(analyser.sampleValue);
      },
    };

    context.analysers.push(analyser);
    return analyser;
  };
  return context;
}

const tick = () => new Promise(resolve => setImmediate(resolve));

async function Settle()
{
  for (let index = 0; index < 4; index++)
  {
    await tick();
  }
}

const CURVE = { scaling: 2, points: [ { x: 0, value: 0 }, { x: 1000, value: -96 } ] };

/**
 * A backend whose every event is one limited Sound. `sounds[eventName]` gives
 * the Sound's `voiceLimits`, `priority`, `virtualVoice`, `loop` and duration.
 */
function Harness(sounds)
{
  const context = FakeContext();
  const finished = [];
  const emitter = { EventFinishedCallback: playingID => finished.push(playingID) };
  const selectionOf = (eventName, actionIndex = 0) =>
  {
    const sound = sounds[eventName];

    return {
      mediaID: "100",
      actionIndex,
      leafIndex: 0,
      spatial: true,
      dryVolumeCurve: CURVE,
      loop: sound.loop ?? true,
      ...(sound.voiceLimits ? { voiceLimits: sound.voiceLimits } : {}),
      ...(sound.priority ? { priority: sound.priority } : {}),
      ...(sound.virtualVoice ? { virtualVoice: sound.virtualVoice } : {}),
    };
  };
  const backend = new CjsWebAudioSoundEngine({
    context,
    isLoop: () => false,
    resolveSfxProgram: (_eventID, eventName) => [ {
      kind: "play",
      actionIndex: 0,
      selections: [ selectionOf(eventName) ],
    } ],
    loadBuffer: async (_eventID, eventName, _controls, program) => ({
      voices: program.flatMap(operation => operation.selections ?? [])
        .filter(selection => selection.voiceLimitRejected !== true)
        .map(selection => ({
          buffer: { duration: sounds[eventName].duration ?? 10 },
          programSlotId: "0:0",
          actionIndex: selection.actionIndex,
          leafIndex: selection.leafIndex,
          loop: selection.loop,
          spatial: true,
          dryVolumeCurve: CURVE,
        })),
    }),
  });

  return { context, finished, emitter, backend };
}

const limit = (counterId, maxInstances, behavior, extra = {}) => ({
  counterId,
  scope: "game-object",
  maxInstances,
  behavior,
  onLimit: "kill",
  ...extra,
});

/** The live (not stopped) sources of the fake context. */
const Live = context => context.sources.filter(source => source.stoppedAt === null);

test("per object max 2 kill-oldest: the third post stops the oldest with a 50 ms fade", async () =>
{
  const { context, emitter, backend } = Harness({
    gun: { voiceLimits: [ limit("10", 2, "kill-oldest") ] },
  });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "gun");
  backend.PostEvent(7, 1, 0, emitter, "gun");
  await Settle();
  context.currentTime = 1;
  backend.PostEvent(7, 1, 0, emitter, "gun");
  await Settle();

  assert.equal(context.sources.length, 3, "the newcomer plays");
  assert.ok(Math.abs(context.sources[0].stoppedAt - 1.05) < 1e-9, "the oldest fades out over 50 ms");
  assert.equal(context.sources[1].stoppedAt, null);
  assert.equal(backend.GetVoiceLimitReport().killed, 1);
  assert.equal(backend.GetVoiceLimitReport().members, 2, "the evicted voice left its counter at once");
});

test("reject-newest max 1 refuses the newcomer and keeps the playing voice", async () =>
{
  const { context, emitter, backend } = Harness({
    beam: { voiceLimits: [ limit("20", 1, "reject-newest") ] },
  });

  backend.RegisterGameObj(1);
  backend.RegisterGameObj(2);
  backend.PostEvent(7, 1, 0, emitter, "beam");
  await Settle();
  context.currentTime = 1;
  backend.PostEvent(7, 1, 0, emitter, "beam");
  backend.PostEvent(7, 2, 0, emitter, "beam");
  await Settle();

  assert.equal(context.sources.length, 2, "the duplicate on object 1 never loads; object 2 is its own counter");
  assert.equal(Live(context).length, 2);
  const report = backend.GetVoiceLimitReport();

  assert.equal(report.rejected, 1);
  assert.equal(report.counters, 2);
  assert.equal(report.full, 2);
});

test("a global counter spans game objects, and the exempt object neither counts nor loses", async () =>
{
  const global = { ...limit("30", 2, "kill-oldest"), scope: "global" };
  const { context, emitter, backend } = Harness({ hit: { voiceLimits: [ global ] } });

  for (const id of [ 1, 2, 3, 9 ])
  {
    backend.RegisterGameObj(id);
  }
  backend.SetVoiceLimitExemptGameObject(9);
  backend.PostEvent(7, 9, 0, emitter, "hit");
  backend.PostEvent(7, 1, 0, emitter, "hit");
  backend.PostEvent(7, 2, 0, emitter, "hit");
  await Settle();
  context.currentTime = 1;
  backend.PostEvent(7, 3, 0, emitter, "hit");
  await Settle();

  assert.equal(context.sources.length, 4);
  assert.equal(context.sources[0].stoppedAt, null, "the exempt object's voice is never a loser");
  assert.ok(context.sources[1].stoppedAt !== null, "the oldest counted voice (object 1) loses");
  assert.equal(context.sources[2].stoppedAt, null);
  assert.equal(backend.GetVoiceLimitReport().exempt, 9);
  assert.equal(backend.GetVoiceLimitReport().members, 2, "the exempt voice is not counted");
});

test("the exempt object's own per-object limit still applies", async () =>
{
  const { context, emitter, backend } = Harness({
    beam: { voiceLimits: [ limit("20", 1, "reject-newest") ] },
  });

  backend.RegisterGameObj(9);
  backend.SetVoiceLimitExemptGameObject(9);
  backend.PostEvent(7, 9, 0, emitter, "beam");
  await Settle();
  backend.PostEvent(7, 9, 0, emitter, "beam");
  await Settle();

  assert.equal(context.sources.length, 1);
  assert.equal(backend.GetVoiceLimitReport().rejected, 1);
});

test("a bus counter and a node counter admit atomically: no eviction when one refuses", async () =>
{
  const bus = { ...limit("bus:5", 2, "kill-oldest"), scope: "global" };
  const { context, emitter, backend } = Harness({
    engine: { voiceLimits: [ limit("40", 1, "reject-newest"), bus ] },
    other: { voiceLimits: [ bus ] },
  });

  backend.RegisterGameObj(1);
  backend.RegisterGameObj(2);
  backend.PostEvent(7, 1, 0, emitter, "engine");
  backend.PostEvent(7, 2, 0, emitter, "other");
  await Settle();
  context.currentTime = 1;
  // The bus is full (kill-oldest would evict object 1's engine), but object 1's
  // node counter refuses the newcomer: nothing is evicted.
  backend.PostEvent(7, 1, 0, emitter, "engine");
  await Settle();

  assert.equal(context.sources.length, 2);
  assert.equal(Live(context).length, 2);
  assert.equal(backend.GetVoiceLimitReport().killed, 0);

  // Object 2's newcomer passes its node counter, so the bus evicts its oldest.
  backend.PostEvent(7, 2, 0, emitter, "engine");
  await Settle();
  assert.equal(context.sources.length, 3);
  assert.ok(context.sources[0].stoppedAt !== null, "the bus's oldest member loses");
});

test("priority: a higher newcomer evicts a lower member, a lower newcomer is refused", async () =>
{
  const shared = limit("50", 1, "reject-newest");
  const { context, emitter, backend } = Harness({
    low: { voiceLimits: [ shared ], priority: { value: 40, distanceOffset: null } },
    high: { voiceLimits: [ shared ], priority: { value: 80, distanceOffset: null } },
    lower: { voiceLimits: [ shared ], priority: { value: 10, distanceOffset: null } },
  });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "low");
  await Settle();
  context.currentTime = 1;
  backend.PostEvent(7, 1, 0, emitter, "high");
  await Settle();
  assert.equal(context.sources.length, 2);
  assert.ok(context.sources[0].stoppedAt !== null, "reject-newest only breaks ties; priority wins first");

  backend.PostEvent(7, 1, 0, emitter, "lower");
  await Settle();
  assert.equal(context.sources.length, 2, "the lower newcomer is refused");
});

test("the distance offset: at an equal base the farther voice loses", async () =>
{
  const global = { ...limit("60", 1, "reject-newest"), scope: "global" };
  const { context, emitter, backend } = Harness({
    shot: { voiceLimits: [ global ], priority: { value: 50, distanceOffset: -50 } },
  });

  backend.RegisterGameObj(1);
  backend.RegisterGameObj(2);
  backend.SetListenerPosition(0, [ 0, 0, 1 ], [ 0, 1, 0 ], [ 0, 0, 0 ]);
  backend.SetPosition(1, [ 0, 0, 1 ], [ 0, 1, 0 ], [ 900, 0, 0 ]);
  backend.SetPosition(2, [ 0, 0, 1 ], [ 0, 1, 0 ], [ 100, 0, 0 ]);
  backend.PostEvent(7, 1, 0, emitter, "shot");
  await Settle();
  context.currentTime = 1;
  backend.PostEvent(7, 2, 0, emitter, "shot");
  await Settle();

  assert.equal(context.sources.length, 2, "the nearer newcomer (50 - 5) beats the far member (50 - 45)");
  assert.ok(context.sources[0].stoppedAt !== null);

  backend.PostEvent(7, 1, 0, emitter, "shot");
  await Settle();
  assert.equal(context.sources.length, 2, "the far newcomer loses to the near member");
});

test("a loading member is never evicted: the newcomer loses instead", async () =>
{
  let release;
  const gate = new Promise(resolve =>
  {
    release = resolve;
  });
  const sounds = { gun: { voiceLimits: [ limit("70", 1, "kill-oldest") ] } };
  const { context, emitter, backend } = Harness(sounds);
  const load = backend._loadBuffer;
  let calls = 0;

  backend._loadBuffer = async (...args) =>
  {
    calls++;
    if (calls === 1)
    {
      await gate;
    }
    return load(...args);
  };
  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "gun");
  await Settle();
  backend.PostEvent(7, 1, 0, emitter, "gun");
  await Settle();
  assert.equal(backend.GetVoiceLimitReport().rejected, 1, "kill-oldest cannot pick the still-loading voice");

  release();
  await Settle();
  assert.equal(context.sources.length, 1);
});

test("the outcome table: onLimit kill, and virtual with each below-threshold behavior", async () =>
{
  const rows = [
    { onLimit: "kill", belowThreshold: "virtual", loop: true, expect: "killed" },
    { onLimit: "virtual", belowThreshold: "continue", loop: true, expect: "continues" },
    { onLimit: "virtual", belowThreshold: "kill", loop: true, expect: "killed" },
    { onLimit: "virtual", belowThreshold: "virtual", loop: false, expect: "virtual" },
    { onLimit: "virtual", belowThreshold: "kill-if-finite-else-virtual", loop: true, expect: "virtual" },
    { onLimit: "virtual", belowThreshold: "kill-if-finite-else-virtual", loop: false, expect: "killed" },
  ];

  for (const row of rows)
  {
    const sound = {
      loop: row.loop,
      voiceLimits: [ limit("80", 1, "kill-oldest", { onLimit: row.onLimit }) ],
      virtualVoice: { belowThreshold: row.belowThreshold, onReturn: "resume" },
    };
    const { context, emitter, backend } = Harness({ a: sound, b: sound });

    backend.RegisterGameObj(1);
    backend.PostEvent(7, 1, 0, emitter, "a");
    await Settle();
    context.currentTime = 1;
    backend.PostEvent(7, 1, 0, emitter, "b");
    await Settle();
    const report = backend.GetVoiceLimitReport();
    const label = JSON.stringify(row);

    assert.equal(context.sources.length, 2, label);
    assert.equal(context.sources[1].stoppedAt, null, `the newcomer plays: ${label}`);
    if (row.expect === "continues")
    {
      assert.equal(context.sources[0].stoppedAt, null, label);
      assert.equal(report.members, 2, `the counter passes its max: ${label}`);
    }
    else
    {
      assert.ok(Math.abs(context.sources[0].stoppedAt - 1.05) < 1e-9, label);
      assert.equal(report.killed, row.expect === "killed" ? 1 : 0, label);
      assert.equal(report.virtualized, row.expect === "virtual" ? 1 : 0, label);
      assert.equal(report.virtual, row.expect === "virtual" ? 1 : 0, label);
    }
  }
});

/** A member parked virtual at t=1, the newcomer ending at t=3: the returned source's offset. */
async function VirtualReturnOffset(onReturn)
{
  const sound = {
    voiceLimits: [ limit("90", 1, "kill-oldest", { onLimit: "virtual" }) ],
    virtualVoice: { belowThreshold: "virtual", onReturn },
  };
  const { context, emitter, backend, finished } = Harness({ a: sound, b: sound });

  backend.RegisterGameObj(1);
  const a = backend.PostEvent(7, 1, 0, emitter, "a");
  await Settle();
  context.currentTime = 1;
  const b = backend.PostEvent(7, 1, 0, emitter, "b");
  await Settle();
  context.currentTime = 1.1;
  backend.RenderAudio();
  assert.equal(backend._playing.get(a).voices[0].paused, true, "the member parked");
  context.currentTime = 3;
  backend.ExecuteActionOnPlayingID("stop", b, 0);
  context.sources[1].onended();
  await Settle();
  assert.equal(context.sources.length, 3, "the virtual voice returned on a new source");
  assert.equal(backend.GetVoiceLimitReport().returned, 1);
  assert.equal(finished.includes(a), false);
  return context.sources[2].offset;
}

test("a virtual voice returns from the beginning, from elapsed time or by resume", async () =>
{
  assert.equal(await VirtualReturnOffset("from-beginning"), 0);
  const resume = await VirtualReturnOffset("resume");

  assert.ok(resume > 0.9 && resume < 1.1, `resume keeps the parked position (${resume})`);
  const elapsed = await VirtualReturnOffset("from-elapsed");

  assert.ok(elapsed > 2.9 && elapsed < 3.1, `from-elapsed counts the virtual time (${elapsed})`);
});

test("a virtual newcomer waits without a source, keeps its record, and a stop drops it", async () =>
{
  const sound = {
    voiceLimits: [ limit("95", 1, "reject-newest", { onLimit: "virtual" }) ],
    virtualVoice: { belowThreshold: "virtual", onReturn: "from-beginning" },
  };
  const { context, emitter, backend, finished } = Harness({ a: sound, b: sound });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "a");
  await Settle();
  const b = backend.PostEvent(7, 1, 0, emitter, "b");
  await Settle();

  assert.equal(context.sources.length, 1, "the newcomer waits virtual");
  assert.equal(backend._playing.has(b), true, "its record stays alive");
  assert.equal(backend.GetVoiceLimitReport().virtual, 1);

  backend.ExecuteActionOnPlayingID("stop", b, 0);
  await Settle();
  assert.equal(backend._playing.has(b), false);
  assert.ok(finished.includes(b));
  assert.equal(backend.GetVoiceLimitReport().virtual, 0, "the stop dropped the virtual entry");
});

test("a finite from-elapsed virtual voice ends once its media would have", async () =>
{
  const sound = {
    loop: false,
    duration: 2,
    voiceLimits: [ limit("96", 1, "reject-newest", { onLimit: "virtual" }) ],
    virtualVoice: { belowThreshold: "virtual", onReturn: "from-elapsed" },
  };
  const { context, emitter, backend, finished } = Harness({ a: sound, b: sound });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "a");
  await Settle();
  const b = backend.PostEvent(7, 1, 0, emitter, "b");
  await Settle();
  context.currentTime = 2.5;
  backend.RenderAudio();

  assert.ok(finished.includes(b), "the virtual one-shot ran out while waiting");
  assert.equal(backend.GetVoiceLimitReport().virtual, 0);
});

test("a virtual outcome on a continuation-slot voice is a kill, counted as virtualAsKill", async () =>
{
  const sound = {
    voiceLimits: [ limit("97", 1, "reject-newest", { onLimit: "virtual" }) ],
    virtualVoice: { belowThreshold: "virtual", onReturn: "from-beginning" },
  };
  const { context, emitter, backend } = Harness({ a: sound, b: sound });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "a");
  await Settle();
  const original = backend._IsPlainSfxVoice.bind(backend);

  backend._IsPlainSfxVoice = () => false;
  backend.PostEvent(7, 1, 0, emitter, "b");
  await Settle();
  backend._IsPlainSfxVoice = original;

  const report = backend.GetVoiceLimitReport();

  assert.equal(context.sources.length, 1);
  assert.equal(report.virtualAsKill, 1);
  assert.equal(report.virtual, 0);
});

test("the report counts admissions and outcomes since start", async () =>
{
  const { emitter, backend } = Harness({
    gun: { voiceLimits: [ limit("98", 1, "kill-oldest") ] },
  });

  backend.RegisterGameObj(1);
  for (let index = 0; index < 3; index++)
  {
    backend.PostEvent(7, 1, 0, emitter, "gun");
    await Settle();
  }
  assert.deepEqual(backend.GetVoiceLimitReport(), {
    exempt: 0,
    counters: 1,
    full: 1,
    members: 1,
    virtual: 0,
    admitted: 3,
    rejected: 0,
    killed: 2,
    virtualized: 0,
    returned: 0,
    virtualAsKill: 0,
  });
});

test("malformed limits refuse the program before any reservation", () =>
{
  const { emitter, backend } = Harness({
    bad: { voiceLimits: [ { counterId: "1", scope: "galaxy", maxInstances: 1, behavior: "kill-oldest" } ] },
  });

  backend.RegisterGameObj(1);
  backend.PostEvent(7, 1, 0, emitter, "bad");
  assert.equal(backend.GetVoiceLimitReport().admitted, 0);
});
