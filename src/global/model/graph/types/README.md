# Standalone value handlers

These handlers are not registered with Blue or connected to the current readers,
writers or schema. Object, list and struct classes remain placeholders.

All 31 distinct Carbon VARTYPE identities have separate definitions: 20 have
value operations, Invalid explicitly throws, six are pending, and four are
unsupported Python or stream-marker definitions.
The exhaustive mapping is test-only in `test/global/graph-carbon-types.test.js`;
there is no new runtime registry. VARTYPE_MAX is an alias and VARTYPE_FORCELONG
is an enum-width sentinel, so neither creates another handler.

Pending operations: IRoot, IRootPtr, IRootWeakRef, CharArray, BinaryBlock and
ScriptCallback. Unsupported/non-value definitions: PyObject,
PyObjectPtr, PyProperty and RotReference. These definitions deliberately have
no value methods: graph ownership, fixed byte buffers and custom persistence
must not silently become scalar copying.

Invalid implements the same static and instance operation interface as the value
handlers, but every operation throws TypeError before accessing its inputs.
Graph members without an assigned handler share this default; assigning a real
handler through a replacement definition removes the default. It does not infer a
type from the value. The remaining Python/stream-marker shells are retained only
as Carbon identities, not enabled for JS value handling.

String and WString retain full JS string contents, including embedded NULs.
CString, WCString, Reference, WReference, SharedString and SharedStringW retain
their separate identities and share NUL-terminated prefix operations. Native
shared-string interning is represented by immutable JS string value equality.
These are storage operations, not Python conversion or character-encoding codecs.

`CjsGraphTypeScalar` shares property access and instance shortcuts. Numeric types
derive from `CjsGraphTypeNumber`, with shared width conversion in
`CjsGraphTypeInteger` and `CjsGraphTypeBigInt`. Float32 and Float64 retain their
Carbon scalar tolerances. Boolean and string retain their scalar specialisations;
future path/expression handlers belong under the string family, not copied operations.

| Family | Concrete definitions |
| --- | --- |
| Number scalars | Int8, Uint8, Int16, Uint16, Int32, Uint32, Float32, Float64 |
| BigInt scalars | Int64, Uint64 |
| Typed arrays | Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array |
| Named math | Vector2, Vector2d, Vector3, Vector3d, Vector3i, Vector4, Vector4d, Matrix, Color, Quaternion |

All typed-array definitions extend `CjsGraphTypeArray`. They select the storage
constructor, scalar element conversion and comparison policy. The base owns the
loops, reads, writes, cloning and storage reuse. Uint8ClampedArray supplies its
own saturating, ties-to-even conversion. Conversion must match the selected
constructor because writes use native TypedArray.set, including its overlap safety.
No temporary typed array is allocated to round or compare a value.

Arrays accept a property options record with `length` (`-1` for variable length);
an instance's fields are its default options. No handler is allocated per property.
Named math definitions supply fixed default counts for both static and instance
writes; Is also checks that count. They reuse array conversion and comparison,
without performing mathematical transforms, normalisation or colour conversion.

Static operations are `get(target, key, options)`, `set(target, key, value, options)`,
`copy(source, sourceKey, target, key, options)`, `clone(target, key, options)`, `is(value)`,
`isExactEqual(a, b)` `isEqual(a, b)` and `isLike(a, b, options)`. Instance shortcuts capitalise the same
names. There is no From, schema lookup, accessor resolution or destruction.

Set/Copy report an exact change after destination conversion. This is a JS
convenience, unlike Carbon Copy's success result. IsEqual applies native
comparison semantics; it does not decide whether to assign. In particular,
Carbon's float-array NaN comparison quirk is retained.

Carbon's DOUBLEARRAY and INTARRAY have no AreEqual specialisation: their native
default returns false, even for identical or empty arrays. Float64Array and
Int32Array preserve that result in IsEqual/IsLike; IsExactEqual and Set/Copy's exact
change reporting remain independent. Other additional JS array families compare
elements exactly. This is not a claim that Carbon exposes those additional families.

Integer scalar conversion wraps to its width; 8/16/32-bit storage truncates and
maps non-finite inputs to zero like native JS typed arrays. Int64/Uint64 use BigInt
and accept BigInt, integer strings and booleans through native BigInt storage
conversion. Number inputs throw: callers must explicitly choose an exact BigInt
conversion first. This differs from the legacy values codec, which mixes safe
Numbers with BigInts; that codec is not changed or connected to these handlers.
Get/Clone preserve BigInts, including within plain values arrays; JSON encoding
is outside this layer. Numeric Is checks canonical representation and integer range;
Set performs conversion rather than invoking Is.

Array Get produces a plain values array. Clone explicitly allocates an owned
independent typed array. Set retains existing typed storage when sizes match;
only variable-length size changes allocate replacement storage. Fixed-length
sources and destinations must match the declared count. Owners initialise
storage; lazy construction is not introduced here. Overlapping typed views
are copied safely through TypedArray.set after comparison completes.

Specialised path/expression behaviour and graph-value
handlers are still pending. No Float16Array definition is added: it is not in the
runtime's current supported typed-array family.

This subtree imports only its own files and uses JavaScript built-ins. Blue exposure identifiers
are supplied by the future Blue definition adapter, not stored or imported by these handlers.
IsLike normalizes accepted forms with the same conversion as Set before comparing. The existing
conversion behavior is retained during relocation; stricter format validation is not silently adopted.

All Get/Set/Copy/Clone operations accept options last. Object/list/struct operations will use that
same interface with the graph operation context; their implementations are still pending.
Ownership edges and operation-owned creations must be recorded before destruction is implemented.
No placeholder Destruct method promises cleanup today.

IsEqual requires canonical representations; IsLike accepts alternate representations.
Instance shortcuts currently expect a complete property options record when explicitly supplied.
Graph integration must keep compiled property settings separate from operation state so passing
a context cannot discard a fixed length. That integration is not implemented yet.
