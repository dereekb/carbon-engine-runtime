// Ours: when the WebGL2 backend links an effect's shader programs
// (Tr2EffectStateManager.webgl2ProgramLinking). Carbon creates each program
// while reading the effect (Tr2EffectStateManager.cpp:572-574).

/**
 * When WebGL2 shader programs link.
 */
export const Webgl2ProgramLinking = Object.freeze({
  /** At the program's first draw: the cheapest start, nothing linked that is never drawn. */
  FIRST_USE: 0,

  /** At effect read, as Carbon does: every program starts linking then, and a refusal is reported once known. */
  EFFECT_READ: 1
});
