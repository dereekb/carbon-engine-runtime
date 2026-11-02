import test from "node:test";
import assert from "node:assert/strict";
import { CjsWebAudioSoundEngine } from "../../../npm/dist/audio/index.js";
import { FakeDynamicsCompressor } from "../../support/webAudioNodes.js";
import { MusicEngineWith } from "../../support/audioStub.js";

// The backend indexes its playing records by emitter-node generation, so one
// emitter's pose, scaling, RTPC or control refresh touches only that
// generation's records instead of every playing record (2026-11-02: 2,100
// records on 76 emitters cost 33 ms a frame walking them all per emitter).
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

function Harness({ musicEngine } = {})
{
  const context = FakeContext();
  const finished = [];
  const emitter = { EventFinishedCallback: playingID => finished.push(playingID) };
  const backend = new CjsWebAudioSoundEngine({
    context,
    loadBuffer: async () => ({ fake: "buffer" }),
    isLoop: eventName => String(eventName).includes("loop"),
    musicEngine,
  });
  return { context, finished, emitter, backend };
}

/** The index holds exactly the playing records that have a generation, under it, with no empty bucket. */
function AssertIndex(backend)
{
  const indexed = new Map();

  for (const [ nodes, bucket ] of backend._playingByEmitterNodes)
  {
    assert.ok(bucket.size > 0, "no empty bucket is kept");
    for (const [ playingID, record ] of bucket)
    {
      assert.equal(record.emitterNodes, nodes, "a record sits under its own generation");
      assert.equal(indexed.has(playingID), false, "a record sits in one bucket");
      indexed.set(playingID, record);
    }
  }
  const expected = [ ...backend._playing ]
    .filter(([ , record ]) => record.emitterNodes);

  assert.deepEqual(
    [ ...indexed.keys() ].sort((a, b) => a - b),
    expected.map(([ playingID ]) => playingID).sort((a, b) => a - b),
  );
  for (const [ playingID, record ] of expected)
  {
    assert.equal(indexed.get(playingID), record);
  }
}

/** Counts _ApplyVoiceDistanceGain calls (one per live voice a refresh visits) by game object. */
function SpyDistanceGains(backend)
{
  const visits = [];
  const original = backend._ApplyVoiceDistanceGain.bind(backend);

  backend._ApplyVoiceDistanceGain = (voice, emitterNodes, smooth) =>
  {
    visits.push(emitterNodes);
    return original(voice, emitterNodes, smooth);
  };
  return visits;
}

test("posts index under their emitter generation and finishing unindexes them", async () =>
{
  const { context, emitter, backend } = Harness();

  backend.RegisterGameObj(1);
  backend.RegisterGameObj(2);
  const a = backend.PostEvent(10, 1, 0, emitter, "shot_a");
  const b = backend.PostEvent(11, 2, 0, emitter, "shot_b");
  const c = backend.PostEvent(12, 1, 0, emitter, "hum_loop");

  await Settle();
  AssertIndex(backend);
  assert.deepEqual(
    [ ...backend._PlayingRecordsOf(backend._emitterNodes.get(1)).keys() ],
    [ a, c ],
    "a bucket keeps playingID order",
  );
  assert.deepEqual([ ...backend._PlayingRecordsOf(backend._emitterNodes.get(2)).keys() ], [ b ]);

  context.sources[1].onended();
  assert.equal(backend._playing.has(b), false);
  assert.equal(backend._playingByEmitterNodes.has(backend._emitterNodes.get(2)), false, "an emptied bucket is dropped");
  AssertIndex(backend);

  context.sources[0].onended();
  AssertIndex(backend);
  assert.deepEqual([ ...backend._PlayingRecordsOf(backend._emitterNodes.get(1)).keys() ], [ c ]);
  assert.equal(backend._PlayingRecordsOf(null).size, 0);
  assert.equal(backend._PlayingRecordsOf(undefined).size, 0);
});

test("a re-registered emitter's old records stay under the retired generation and a pose moves only the new ones", async () =>
{
  const { context, emitter, backend } = Harness();

  backend.RegisterGameObj(1);
  backend.SetPosition(1, [ 0, 0, -1 ], [ 0, 1, 0 ], [ 1, 2, 3 ]);
  const old = backend.PostEvent(10, 1, 0, emitter, "old_loop");

  await Settle();
  const retired = backend._emitterNodes.get(1);

  backend.UnregisterGameObj(1);
  backend.RegisterGameObj(1);
  const current = backend._emitterNodes.get(1);
  const fresh = backend.PostEvent(11, 1, 0, emitter, "new_loop");

  await Settle();
  AssertIndex(backend);
  assert.notEqual(retired, current);
  assert.deepEqual([ ...backend._PlayingRecordsOf(retired).keys() ], [ old ]);
  assert.deepEqual([ ...backend._PlayingRecordsOf(current).keys() ], [ fresh ]);

  const visits = SpyDistanceGains(backend);

  backend.SetPosition(1, [ 0, 0, -1 ], [ 0, 1, 0 ], [ 4, 5, 6 ]);
  assert.deepEqual(visits, [ current ], "the pose refreshes the current generation's voice only");

  visits.length = 0;
  backend.SetListenerPosition(0, [ 0, 0, -1 ], [ 0, 1, 0 ], [ 0, 0, 0 ]);
  assert.deepEqual(visits, [ retired, current ], "the listener refreshes every record");

  context.sources[0].stop();
  context.sources[0].onended();
  AssertIndex(backend);
  assert.equal(backend._playingByEmitterNodes.has(retired), false, "the retired generation is let go");
  assert.equal(retired.panner.disconnected, true);
});

test("ReleaseGameObj, StopAll and Dispose leave the index empty", async () =>
{
  const { emitter, backend } = Harness();

  for (const gameObjID of [ 1, 2, 3 ])
  {
    backend.RegisterGameObj(gameObjID);
    backend.PostEvent(10, gameObjID, 0, emitter, "hum_loop");
    backend.PostEvent(11, gameObjID, 0, emitter, "shot");
  }
  await Settle();
  assert.equal(backend._playingByEmitterNodes.size, 3);

  backend.ReleaseGameObj(1);
  AssertIndex(backend);
  assert.equal(backend._playingByEmitterNodes.size, 2);

  backend.StopAll();
  AssertIndex(backend);
  assert.equal(backend._playingByEmitterNodes.size, 0);

  backend.PostEvent(12, 2, 0, emitter, "hum_loop");
  await Settle();
  assert.equal(backend._playingByEmitterNodes.size, 1);
  backend.Dispose();
  assert.equal(backend._playing.size, 0);
  assert.equal(backend._playingByEmitterNodes.size, 0);
});

test("a music-only record keeps its generation indexed until it finishes", async () =>
{
  const completes = new Map();
  const musicEngine = MusicEngineWith({
    HandlesEvent: () => true,
    PostEvent: (eventName, playingID, complete) =>
    {
      completes.set(playingID, complete);
    },
  });
  const { emitter, backend } = Harness({ musicEngine });

  backend.RegisterGameObj(3);
  const nodes = backend._emitterNodes.get(3);
  const playingID = backend._PostMusicEvent("music_theme", { gameObjID: 3, emitter });

  assert.ok(playingID > 0);
  AssertIndex(backend);
  assert.deepEqual([ ...backend._PlayingRecordsOf(nodes).keys() ], [ playingID ]);

  backend.UnregisterGameObj(3);
  assert.equal(nodes.panner.disconnected, false, "the music record keeps its retired generation");

  completes.get(playingID)();
  AssertIndex(backend);
  assert.equal(backend._playing.has(playingID), false);
  assert.equal(backend._playingByEmitterNodes.size, 0);
  assert.equal(nodes.panner.disconnected, true);

  const unregistered = backend._PostMusicEvent("music_menu", { gameObjID: 9 });

  assert.ok(unregistered > 0);
  assert.equal(backend._playing.get(unregistered).emitterNodes, null);
  AssertIndex(backend);
});

test("a finish callback that posts again leaves the index in step", async () =>
{
  const { context, backend } = Harness();
  const reposted = [];
  const emitter = {
    EventFinishedCallback: () =>
    {
      if (reposted.length < 2)
      {
        reposted.push(backend.PostEvent(20, 1, 0, emitter, "shot_again"));
      }
    },
  };

  backend.RegisterGameObj(1);
  backend.PostEvent(10, 1, 0, emitter, "shot");
  await Settle();
  context.sources[0].onended();
  AssertIndex(backend);
  await Settle();
  context.sources[1].onended();
  AssertIndex(backend);
  await Settle();
  assert.equal(reposted.length, 2);
  assert.deepEqual(
    [ ...backend._PlayingRecordsOf(backend._emitterNodes.get(1)).keys() ],
    [ reposted[1] ],
  );
});

test("one emitter's refresh visits only its own records: 40 emitters by 25 records", async () =>
{
  const { emitter, backend } = Harness();

  for (let gameObjID = 1; gameObjID <= 40; gameObjID++)
  {
    backend.RegisterGameObj(gameObjID);
    backend.SetPosition(gameObjID, [ 0, 0, -1 ], [ 0, 1, 0 ], [ gameObjID, 0, 0 ]);
    for (let index = 0; index < 25; index++)
    {
      backend.PostEvent(100 + index, gameObjID, 0, emitter, `hum_${index}_loop`);
    }
  }
  await Settle();
  assert.equal(backend._playing.size, 1000);
  AssertIndex(backend);

  let walks = 0;
  const values = backend._playing.values.bind(backend._playing);

  backend._playing.values = () =>
  {
    walks++;
    return values();
  };
  const visits = SpyDistanceGains(backend);
  const nodes = backend._emitterNodes.get(17);

  backend.SetPosition(17, [ 0, 0, -1 ], [ 0, 1, 0 ], [ 0, 5, 0 ]);
  assert.equal(walks, 0, "a pose never walks every playing record");
  assert.equal(visits.length, 25);
  assert.ok(visits.every(value => value === nodes));

  visits.length = 0;
  backend.SetScalingFactor(17, 2);
  assert.equal(walks, 0);
  assert.equal(visits.length, 25);

  visits.length = 0;
  backend.SetListenerPosition(0, [ 0, 0, -1 ], [ 0, 1, 0 ], [ 0, 0, 1 ]);
  assert.equal(walks, 1, "the listener pose walks every record once");
  assert.equal(visits.length, 1000);
});
