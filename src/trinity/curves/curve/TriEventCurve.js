import { exposure as be } from "#be";
// Source: trinity/trinity/Curves/TriEventCurve.h
// Source: trinity/trinity/Curves/TriEventCurve.cpp
import { ITriFunction, IInitialize, ITriCurveLength, BlueList } from "#blue";
import { CjsSchema, type, blue } from "#schema";
import { TRIEXTRAPOLATION } from "#consts/graphics";
import { TriEventKey } from "../key/TriEventKey.js";
import "#consts/graphics/trinityEnums";


/**
 * Time-keyed event track that fires each key once as the playhead passes it,
 * dispatching either a named event to a listener or a queued callable, and
 * restarting the key cursor when time rewinds or a cycle wraps.
 */
@be.define({
  name: "TriEventCurve",
  inherit: [ IInitialize, ITriCurveLength ],
  // TriEventCurve_Blue.cpp:11-112, in Carbon's order.
  interfaces: [ ITriFunction, IInitialize, ITriCurveLength ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "time", be.READ ],
    [ be.ATTR, "length", be.READ ],
    [ be.ATTR, "localTime", be.READ ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "keys", be.PERSISTONLY ],
    [ be.ATTR_CHOOSER, "extrapolation", be.READWRITE | be.PERSIST | be.ENUM, "blue.TRIEXTRAPOLATION" ],
    [ be.ATTR, "eventListener", be.READWRITE ],
    [ be.METHOD, "AddKey", be.WRAP ],
    [ be.METHOD, "AddCallableKey", be.WRAP ],
    [ be.METHOD, "RemoveKey", be.WRAP ],
    [ be.METHOD, "GetKeyCount", be.WRAP ],
    [ be.METHOD, "GetKeyValue", be.WRAP ],
    [ be.METHOD, "GetKeyTime", be.WRAP ],
    [ be.METHOD, "SetKeyValue", be.WRAP ],
    [ be.METHOD, "SetKeyTime", be.WRAP ],
    [ be.METHOD, "GetCallableKeyValue", be.WRAP ],
    [ be.METHOD, "GetCallableKeyArgs", be.WRAP ]
  ]
})
export class TriEventCurve extends ITriFunction
{
  /**
   * Class-local JavaScript FIFO of queued callable-key callbacks, drained by the explicit queue
   * helpers.
   * @type {Array<Function>}
   */
  static _postUpdateCallbacks = [];

  /**
   * Queues work in the retained class-local JavaScript post-update queue.
   * @param {Function} callback Work to run.
   * @returns {void}
   */
  static queuePostUpdateCallback(callback)
  {
    this._postUpdateCallbacks.push(callback);
  }

  /**
   * Runs one class-local callback in JavaScript.
   * @returns {boolean} Whether one ran.
   */
  static runNextPostUpdateCallback()
  {
    const callback = this._postUpdateCallbacks.shift();
    if (!callback)
    {
      return false;
    }
    callback();
    return true;
  }

  /**
   * Flushes class-local callbacks up to a JavaScript limit.
   * @param {number} limit Maximum callbacks.
   * @returns {number} Callbacks run.
   */
  static flushPostUpdateCallbacks(limit = Number.POSITIVE_INFINITY)
  {
    let count = 0;
    while (count < limit && this.runNextPostUpdateCallback())
    {
      count++;
    }
    return count;
  }

  /**
   * Returns the class-local callback count.
   * @returns {number}
   */
  static getPostUpdateCallbackCount()
  {
    return this._postUpdateCallbacks.length;
  }

  /**
   * Clears the class-local JavaScript callback queue.
   * @returns {void}
   */
  static clearPostUpdateCallbacks()
  {
    this._postUpdateCallbacks.length = 0;
  }

  /**
   * Authored name identifying the event track.
   * @type {string}
   */

  @type.string
  name = "";

  /**
   * Last accepted update time in seconds, retained to detect rewinds; native float64 metadata.
   * @type {number}
   */
  @type.float64
  time = 0;

  /**
   * Cached final key time in seconds; zero prevents event advancement. Native float32 metadata.
   * @type {number}
   */
  @type.float32
  length = 0;

  /**
   * Event-comparison time in seconds: modulo length in cycle mode, otherwise incoming time.
   * Rewind updates leave this cached value unchanged.
   * @type {number}
   */
  @type.float32
  localTime = 0;

  /**
   * Stored string value of the most recently triggered key; native wide string.
   * @type {string}
   */

  @type.wstring
  value = "";

  /**
   * Owned event keys, sorted by key time by initialization and editing helpers.
   * @type {BlueList<TriEventKey>}
   */
  @type.list("TriEventKey")
  keys = new BlueList(TriEventKey, { className: "TriEventKey", listOps: 0 });

  /**
   * TRIEXTRAPOLATION time-wrapping mode; CYCLE repeats the track and other modes use incoming
   * time unchanged.
   * @type {number}
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Curves/TriEventCurve_Blue.cpp:47); chooser TriExtrapolation (trinity/trinity/TriConstants.cpp:94).
   */
  @type.int32
  @type.enum("blue.TRIEXTRAPOLATION")
  extrapolation = TRIEXTRAPOLATION.TRIEXT_NONE;

  /**
   * Optional recipient of nonempty named events when the triggered key does not take the callable
   * branch.
   * @type {IBlueEventListener|null}
   */
  @type.object.ref("IBlueEventListener")
  eventListener = null;

  /**
   * Index of the next key to dispatch; reset on sorting, rewind or cycle wrap.
   * @type {number}
   */
  _currentKeyIndex = 0;

  /**
   * Advances event time, preserving the existing JavaScript callback-queue adaptation.
   * JavaScript retains numeric seconds, cursor indices and the class-local post-update queue; native uses device callbacks and key lifetimes.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @returns {void}
   */
  UpdateValue(time)
  {
    if (this.length === 0)
    {
      return;
    }
    const before = this.time;
    this.time = time;
    if (this.time < before)
    {
      this._currentKeyIndex = 0;
      return;
    }
    if (this.extrapolation === TRIEXTRAPOLATION.TRIEXT_CYCLE)
    {
      const localNow = this.time % this.length;
      if (localNow < this.localTime)
      {
        this._currentKeyIndex = 0;
      }
      this.localTime = localNow;
    }
    else
    {
      this.localTime = this.time;
    }
    while (this._currentKeyIndex < this.keys.length && this.localTime >= this.keys[this._currentKeyIndex].time)
    {
      this.FireKey(this.keys[this._currentKeyIndex]);
      this._currentKeyIndex++;
    }
  }

  /**
   * Sorts hydrated keys using the retained JavaScript helper.
   * The helper resets an empty track length to zero, unlike the native empty-list branch.
   *
   * @adapted
   * @returns {boolean} True.
   */
  Initialize()
  {
    this.Sort();
    return true;
  }

  /**
   * Returns the cached track length.
   *
   * @implemented
   * @returns {number} Duration in seconds.
   */
  Length()
  {
    return this.length;
  }

  /**
   * Sorts constructor-owned keys in place and resets the cursor.
   * Native declares Sort without a donor body; this retained JavaScript helper also resets empty length to zero.
   *
   * @adapted
   * @returns {void}
   */
  Sort()
  {
    this.keys.Sort((_context, a, b) => a.time < b.time, null);
    this._currentKeyIndex = 0;
    this.length = this.keys.length ? this.keys[this.keys.length - 1].time : 0;
  }

  /**
   * Creates and inserts a named event key.
   *
   * @implemented
   * @param {number} time Key time in seconds.
   * @param {string} eventName Event name.
   * @returns {void}
   */
  AddKey(time, eventName)
  {
    const key = new TriEventKey();
    key.time = time;
    key.value = eventName;
    this.InsertKey(key);
  }

  /**
   * Creates and inserts a callable event key.
   * Carbon: AddCallableKey (trinity/trinity/Curves/TriEventCurve.cpp:147-159).
   * Normalize arguments before storage, as Carbon does when creating its tuple.
   * JavaScript functions and argument arrays replace Python objects; omitted arguments remain an empty array.
   *
   * @adapted
   * @param {number} time Key time in seconds.
   * @param {Function} callable Function to queue.
   * @param {*} args Callable arguments.
   * @returns {void}
   */
  AddCallableKey(time, callable, args)
  {
    const key = new TriEventKey();
    key.time = time;
    key.callable = callable;
    key.callableArgs = TriEventCurve._normalizeCallableArgs(args);
    this.InsertKey(key);
  }

  /**
   * Inserts a key into the owned typed list and refreshes ordering.
   * JavaScript retains plain-record adoption before native list insertion.
   *
   * @adapted
   * @param {TriEventKey|object} key Key or compatible record.
   * @returns {void}
   */
  InsertKey(key)
  {
    this.keys.Insert(-1, TriEventCurve._ensureEventKey(key));
    this.Sort();
  }

  /**
   * Removes an in-range key and refreshes ordering.
   * JavaScript retains range checks and empty-length reset through Sort.
   *
   * @adapted
   * @param {number} index Key index.
   * @returns {void}
   */
  RemoveKey(index)
  {
    if (index >= 0 && index < this.keys.length)
    {
      this.keys.Remove(index);
      this.Sort();
    }
  }

  /**
   * Returns the number of event keys.
   *
   * @implemented
   * @returns {number}
   */
  GetKeyCount()
  {
    return this.keys.length;
  }

  /**
   * Returns a key time or zero outside the list.
   *
   * @implemented
   * @param {number} index Key index.
   * @returns {number}
   */
  GetKeyTime(index)
  {
    return this.keys[index]?.time ?? 0;
  }

  /**
   * Returns a key string or an empty string outside the list.
   *
   * @implemented
   * @param {number} index Key index.
   * @returns {string}
   */
  GetKeyValue(index)
  {
    return this.keys[index]?.value ?? "";
  }

  /**
   * Sets an in-range key time and reorders the list.
   * JavaScript retains Sort cursor reset; the native setter does not reset its iterator.
   *
   * @adapted
   * @param {number} index Key index.
   * @param {number} time Time in seconds.
   * @returns {void}
   */
  SetKeyTime(index, time)
  {
    if (this.keys[index])
    {
      this.keys[index].time = time;
      this.Sort();
    }
  }

  /**
   * Sets an in-range key event string.
   * JavaScript retains nullish-value coercion to an empty string.
   *
   * @adapted
   * @param {number} index Key index.
   * @param {string|null} value Event name.
   * @returns {void}
   */
  SetKeyValue(index, value)
  {
    if (this.keys[index])
    {
      this.keys[index].value = value ?? "";
    }
  }

  /**
   * Returns a JavaScript callable instead of a Python object.
   *
   * @adapted
   * @param {number} index Key index.
   * @returns {Function|null}
   */
  GetCallableKeyValue(index)
  {
    return this.keys[index]?.callable ?? null;
  }

  /**
   * Returns JavaScript arguments instead of a Python tuple.
   *
   * @adapted
   * @param {number} index Key index.
   * @returns {*}
   */
  GetCallableKeyArgs(index)
  {
    return this.keys[index]?.callableArgs ?? null;
  }

  /**
   * Dispatches the named event or queues a JavaScript callable.
   * Extracted helper retains capture-at-queue-time and existing invalid-callable handling; native device-queue/key-lifetime behavior is not reworked.
   * @param {TriEventKey} key Event key.
   * @returns {void}
   */
  FireKey(key)
  {
    this.value = key.value || "";
    if (typeof key.callable === "function")
    {
      const callable = key.callable;
      const args = TriEventCurve._normalizeCallableArgs(key.callableArgs);
      TriEventCurve.queuePostUpdateCallback(() => callable(...args));
      return;
    }
    if (this.eventListener && this.value)
    {
      this.eventListener.HandleEvent(this.value);
    }
  }

  /**
   * Adopts a plain JavaScript record as a registered event key.
   * @param {TriEventKey|object} key Input record.
   * @returns {TriEventKey}
   */
  static _ensureEventKey(key)
  {
    return CjsSchema.cast(key, TriEventKey) ? key : Object.assign(new TriEventKey(), key);
  }

  /**
   * Normalizes JavaScript callable arguments without Python tuple ownership.
   * @param {*} args Input arguments.
   * @returns {Array}
   */
  static _normalizeCallableArgs(args)
  {
    if (args === null || args === undefined)
    {
      return [];
    }
    return Array.isArray(args) ? args : [args];
  }

  /**
   * Shared extrapolation constants exposed as a class-level convenience.
   * @type {Object<string, number>}
   */
  static TRIEXTRAPOLATION = TRIEXTRAPOLATION;

}

// Exact native exposure table, with no inherited exposure chain.
