/**
 * A registered class's source definition and derived member description.
 * Modelled on: Be::ClassInfo (blueexposure/include/BlueTypes.h:378-402)
 * @cjs Retains JS declaration data alongside the compiled view; no Blue services.
 */
export class CjsGraphClassInfo
{

  /** The registered constructor; metadata compilation never constructs it. */
  ctor = null;

  /** Own declaration snapshot. Replace through CjsGraph.define, not in place. */
  declared = null;

  /** Last compiled snapshot, or null. CjsGraph.getClassInfo refreshes it after registration changes. */
  compiled = null;

  /**
   * Stores the constructor and declaration without deriving or allocating member values.
   * @cjs The graph registry supplies the declaration snapshot.
   */
  constructor(ctor, declared)
  {
    this.ctor = ctor;
    this.declared = declared;
  }

  /** Stable class identity. */
  static className = "CjsGraphClassInfo";

}
