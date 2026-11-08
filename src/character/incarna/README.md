# Incarna classes

Incarna, EVE's walk-in stations, used classes that current Carbon no longer
declares. Its content still names them: a captain's quarters walkway piece is a
`Tr2InteriorStatic` whose mesh areas hold `Tr2ShaderMaterial`s. The classes
here let that content load.

Carbon's git history still holds some of them:

- `Tr2InteriorStatic` and `Tr2InteriorCell` to trinity 24d033fa~1;
- `Tr2ShaderMaterial` to a198e5da~1;
- `Tr2InteriorFlare`, `Tr2InteriorFlareData` and `Tr2InteriorParticleObject`
  to 71329945~1.

Those take their members, flags and methods from that source, and each says so
at its head. The shader library classes (a198e5da~1) also have donors there,
but are still reconstructed from Black records and not yet compared; each head
names its donor. For these reconstructed classes:

- Its members, and their order, are those the records write. Its JSDoc names
  the records.
- It is `@meta.define`d, with no Carbon donor, and carries a class-level
  `@meta.adapted`.
- Its exposure flags, and any interfaces it maps, are guessed. The records show
  only that members persist; interfaces are the ones the consuming scene needs.
- Its behaviour, where it has any, is ours. It is modelled on the nearest class
  current Carbon still has, and each method's JSDoc says where it differs.

| Class | Records | Behaviour |
|---|---|---|
| `Tr2InteriorCell` | none in build 1142708 | Carbon's: one room's statics, its light maps and reflection map, and a variable store of its own, parented to the global store. A `Tr2InteriorScene` holds cells in `cells` and draws their statics. Its spherical-harmonic probes and its light and dynamic membership tests are not ported. |
| `Tr2InteriorStatic` | interior kit pieces | Carbon's: placed by `worldPosition` and `rotation` in its cell's space, bounded by its own geometry, and bound under its cell's store. On `Initialize` it also replaces each area's `Tr2ShaderMaterial` with the `Tr2Effect` it becomes; situation selection is not ported. |
| `Tr2InteriorFlare`, `Tr2InteriorFlareData` | interior flares | Data only: nothing draws them yet. |
| `Tr2InteriorParticleObject` | interior particles | Data only: nothing draws it yet. |
| `Tr2ShaderMaterial` | the effect of an Incarna mesh area | Read, then converted: `CreateEffect` moves its parameters into a `Tr2Effect` whose path comes from the shader library, `res:/graphics/shaders/compiled/dx11/<source>.fxt`. The material itself never draws (`IsGood()` false). |
| `Tr2ShaderManager` | `res:/graphics/shaders/shaderdescriptions.black` | Data only: the shader library, every `Tr2HighLevelShader`. |
| `Tr2HighLevelShader` | the library and `shaderdescriptions/*.black` | Data only: a shader's source path, permutation tags and parameter descriptions. |
| `Tr2ShaderPermuteTag` | the library | Data only: a permutation define and the bit it sets in a compiled row's key. |
| `Tr2ShaderTexDesc`, `Tr2ShaderFloatDesc`, `Tr2ShaderFloat2Desc`, `Tr2ShaderFloat3Desc`, `Tr2ShaderFloat4Desc` | the library | Data only: one parameter's default and editor text. |

Incarna's compiled shaders, `graphics/shaders/compiled/<platform>/*.fxt`, load
through `Tr2EffectRes`; `fxt` is registered as an Incarna-era extension
(`Tr2EffectRes.additionalExtensions`, registered by `core/configuration.js` through `CjsLibrary`).

An opaque request to a `Tr2InteriorStatic` also draws its meshes'
`opaquePrepassAreas`. Incarna drew those in the forward gather after its light pass, and current
Carbon draws them only for picking.
