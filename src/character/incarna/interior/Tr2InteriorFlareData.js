// Incarna: retired from Carbon. Donor: trinity 71329945~1, Interior/Tr2InteriorFlareData.h and _Blue.cpp. See ../README.md.
import { exposure as be } from "#be";
import { CjsSchema, type } from "#schema";
import { IRoot } from "#exposure/IRoot";

/**
 * One image of an interior flare. Data only: nothing draws flares yet.
 *
 * Carbon removed the class in trinity 71329945 (2017-06-28).
 *
 * @adapted data only
 */
export class Tr2InteriorFlareData extends IRoot
{
  /** `m_positionWeight`: where this image sits on the line from the screen centre to the flare. */
  positionWeight = new Float32Array([ 1, 1 ]);

  /** `m_size`: the size in post-projection space. */
  size = new Float32Array([ .1, .1 ]);

  /** `m_textureOffset`: the image's offset in the texture atlas. */
  textureOffset = new Float32Array([ 0, 0 ]);

  /** `m_textureSize`: the image's size in the texture atlas. */
  textureSize = new Float32Array([ 1, 1 ]);

  /** `m_rotation`: whether the billboard turns with screen position. */
  rotation = false;

  /** `m_directionalStretch`: the stretch by screen position. */
  directionalStretch = new Float32Array([ 1, 1 ]);

  /** `m_edgeFadeDistance`: the fade-out distance at the screen's edges. */
  edgeFadeDistance = 1;

  /** `m_centerFadeMinRadius`: the inner radius of the fade at the screen's centre. */
  centerFadeMinRadius = 0;

  /** `m_centerFadeMaxRadius`: the outer radius of the fade at the screen's centre. */
  centerFadeMaxRadius = 0;
}

// Declared imperatively, so this module stays plain ESM that loads from source without a transform.
CjsSchema.decorateField(Tr2InteriorFlareData, "positionWeight", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec2);
CjsSchema.decorateField(Tr2InteriorFlareData, "size", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec2);
CjsSchema.decorateField(Tr2InteriorFlareData, "textureOffset", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec2);
CjsSchema.decorateField(Tr2InteriorFlareData, "textureSize", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec2);
CjsSchema.decorateField(Tr2InteriorFlareData, "rotation", be.mapAttribute(be.READWRITE | be.PERSIST), type.boolean);
CjsSchema.decorateField(Tr2InteriorFlareData, "directionalStretch", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec2);
CjsSchema.decorateField(Tr2InteriorFlareData, "edgeFadeDistance", be.mapAttribute(be.READWRITE | be.PERSIST), type.float32);
CjsSchema.decorateField(Tr2InteriorFlareData, "centerFadeMinRadius", be.mapAttribute(be.READWRITE | be.PERSIST), type.float32);
CjsSchema.decorateField(Tr2InteriorFlareData, "centerFadeMaxRadius", be.mapAttribute(be.READWRITE | be.PERSIST), type.float32);
be.define("Tr2InteriorFlareData")(Tr2InteriorFlareData);
