// Source: trinity/trinity/Lights/Tr2TexturedPointLight.h
// Source: trinity/trinity/Lights/Tr2TexturedPointLight.cpp
// Source: trinity/trinity/Lights/Tr2TexturedPointLight_Blue.cpp
import { exposure as be } from "#be";
import { IsMatch, IInitialize, INotify } from "#blue";
import { type } from "#schema";
import { blue } from "#blue";
import { color } from "#math/color";
import { Tr2Light } from "./Tr2Light.js";
import { Tr2PointLight } from "./Tr2PointLight.js";


/**
 * Point light that projects a texture, adding the texture path and its resolved
 * resource to the point-light attribute set and updating dynamically.
 */
@be.define({
  name: "Tr2TexturedPointLight",
  // Tr2TexturedPointLight_Blue.cpp:11-49, in Carbon's order. The table does not chain,
  // so it maps the point light's rows again, and so does this one.
  interfaces: [ Tr2Light, IInitialize, INotify ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "flags", be.READWRITE | be.PERSIST, "trinity.Tr2LightFlags" ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "radius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "innerRadius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "brightness", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "noiseAmplitude", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseOctaves", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "texturePath", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "texture", be.READ ],
    [ be.ATTR_CHOOSER, "castsShadows", be.READWRITE | be.PERSIST | be.NOTIFY | be.ENUM, "trinity.PerLightShadowSetting" ],
    [ be.ATTR, "isVolumetric", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "lightProfilePath", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "lightProfile", be.READ ]
  ]
})
export class Tr2TexturedPointLight extends Tr2PointLight
{
  @type.object.ref("TriTextureRes")
  texture = null;

  /**
   * m_lightData.texturePath (std::wstring) [READWRITE, PERSIST, NOTIFY]: an attribute over the
   * embedded LightData (Tr2Light.h:102), so an accessor here.
   */
  @type.wpath("TriTextureRes")
  get texturePath()
  {
    return this._lightData.texturePath;
  }

  /** Writes m_lightData.texturePath. */
  set texturePath(value)
  {
    this._lightData.texturePath = value;
  }

  @type.boolean
  isDynamic = true;

  @type.int32
  @type.enum("trinity.Tr2Light.LIGHT_TYPE")
  type = Tr2Light.POINT_LIGHT;

  _saturation = 1;

  /**
   * Carbon SetSaturation (cpp:37-40); consumed by Update below.
   *
   * @implemented
   */

  SetSaturation(saturation)
  {
    this._saturation = Number(saturation);
  }

  /**
   * Carbon Initialize (cpp:16-23): fetch the texture when a path is
   * authored, then the point-light base. The reach is the process-wide
   * manager read at call time, which is what BeResMan is (blue.resMan).
   *
   * @implemented
   */

  Initialize()
  {
    if (this._lightData.texturePath)
    {
      this.SetTexturePath(this._lightData.texturePath);
    }
    return super.Initialize();
  }

  /**
   * Carbon SetLightData (cpp:25-29): the point light's copy, then the texture
   * is refetched from the new data's path.
   *
   * @implemented
   * @param {LightData} lightData
   */

  SetLightData(lightData)
  {
    super.SetLightData(lightData);
    this.SetTexturePath(this._lightData.texturePath);
  }

  /**
   * Carbon OnModified (cpp:42–49): texture changes refetch, then forward base.
   *
   * @implemented
   */

  OnModified(propertyName)
  {
    if (IsMatch(propertyName, "texturePath")) this.SetTexturePath(this._lightData.texturePath);
    return super.OnModified(propertyName);
  }

  /**
   * Carbon SetTexturePath (cpp:31-35): null the resource, then refetch.
   *
   * @implemented
   * @param {string} path Texture resource path.
   */

  SetTexturePath(path)
  {
    this.texture = null;
    if (!path) return;
    this.texture = blue.resMan.GetResource(path);
  }

  /**
   * Applies the texture's average colour with the configured saturation.
   * Carbon Update (Tr2TexturedPointLight.cpp:51-57); no texture leaves the colour unchanged.
   *
   * @implemented
   * @returns {void}
   */

  Update()
  {
    if (!this.texture) return;
    color.saturate(this._lightData.color, this.texture.GetAverageColor(), this._saturation);
  }
}

