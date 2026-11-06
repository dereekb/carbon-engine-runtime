import { CjsGraph } from "./CjsGraph.js";

/**
 * Base class for objects that take part in graph operations: thin forwards and per-object state.
 * @cjs Our class, above IRoot. Direct CjsGraph calls work without it.
 */
export class CjsGraphRoot
{

  /** Per-object state. */
  __cjs = { destructed: false };

  /**
   * Returns this object's values.
   * @cjs
   */
  GetValues(options)
  {
    return CjsGraph.get(this, options);
  }

  /**
   * Writes values into this object; returns what changed, or false.
   * @cjs
   */
  SetValues(values, options)
  {
    return CjsGraph.set(this, values, options);
  }

  /**
   * Tells the policy this object's members changed, after a direct write. No names means
   * every member; a name or an array of names narrows it.
   * @cjs
   */
  UpdateValues(names, options)
  {
    return CjsGraph.updateValues(this, names, options);
  }

  /**
   * Returns one member's value.
   * @cjs
   */
  GetValue(name, options)
  {
    return CjsGraph.getValue(this, name, options);
  }

  /**
   * Writes one member; returns what changed, or false.
   * @cjs
   */
  SetValue(name, value, options)
  {
    return CjsGraph.setValue(this, name, value, options);
  }

  /**
   * Copies another object's values into this one; returns what changed, or false.
   * @cjs
   */
  Copy(source, options)
  {
    return CjsGraph.copy(source, this, options);
  }

  /**
   * Creates a separate graph with this object's values.
   * @cjs
   */
  Clone(options)
  {
    return CjsGraph.clone(this, options);
  }

  /**
   * Creates an instance of this class from values.
   * @cjs
   */
  static from(values, options)
  {
    return CjsGraph.from(this, values, options);
  }

  /** Stable class identity. */
  static className = "CjsGraphRoot";

}
