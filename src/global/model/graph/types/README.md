# Standalone value handlers

These handlers are not registered with Blue or connected to the current readers,
writers or schema. Object, list and struct handlers write through `CjsGraph.get`.

All 31 distinct Carbon VARTYPE identities have separate definitions: 20 have
value operations, Invalid explicitly throws, three are object handlers, three are
pending, and four are unsupported Python or stream-marker definitions.
The exhaustive mapping is test-only in `test/global/graph-carbon-types.test.js`;
there is no new runtime registry. VARTYPE_MAX is an alias and VARTYPE_FORCELONG
is an enum-width sentinel, so neither creates another handler.

Object handlers: IRoot, IRootPtr and IRootWeakRef, on CjsGraphTypeObject.
Pending operations: CharArray, BinaryBlock and ScriptCallback.
Unsupported/non-value definitions: PyObject,
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

The handler carries its size (operator, 2026-11-07). `static elementCount` is set
explicitly on the Array base as 0, meaning any length, and a fixed size is its own
definition: there is no per-property length. Shared statics read it and assume a valid
value, so they make no per-call length checks; validation stays in IsValidValue and the conversion
entry. With elementCount 0 the loop bound comes from the value. Named math definitions
reuse array conversion and comparison, without mathematical transforms, normalisation or
colour conversion.

All handlers share one call shape, options last: `get(target, key, options)`,
`set(target, key, value, options)`, `copy(source, sourceKey, target, key, options)`,
`clone(target, key, options)`, plus `isValidValue(value)`, `isExactEqual(a, b)` and `isEqual(a, b)`. Instance shortcuts capitalise the same names and forward options.
Leaf handlers do not read options and may leave it off their own signature. There is no From, schema lookup, accessor resolution or destruction.

Set/Copy report a change, a JS convenience unlike Carbon Copy's success result, and
IsEqual decides it through isUnchanged. write stores with no comparison, for skipEquality, a
creation or a copy. -0 and 0 are the same value in both comparisons. Carbon's comparisons are
kept. isUnchanged adds
Set's own rule: a stored null or NaN is always overwritten, though a Float32 array element
holding NaN equals anything in IsEqual (CE-202). A Float32 or Float64 scalar holding NaN or
Infinity never equals itself, so Set writes and reports it every time. NaN stays valid input.

Carbon's DOUBLEARRAY and INTARRAY have no AreEqual specialisation, and that gap does not
apply here: IsEqual works on every type, and those families compare as their elements do.
This is not a claim that Carbon exposes the additional JS array families.

Integer scalar conversion wraps to its width; 8/16/32-bit storage truncates and
maps non-finite inputs to zero like native JS typed arrays. Int64/Uint64 use BigInt
and accept BigInt, integer strings and booleans through native BigInt storage
conversion. A safe-integer Number is stored as given, matching the Black reader; any other
Number throws, and BigInt array elements take no Number: callers must explicitly choose an exact BigInt
conversion first. This differs from the legacy values codec, which mixes safe
Numbers with BigInts; that codec is not changed or connected to these handlers.
Get/Clone preserve BigInts, including within plain values arrays; JSON encoding
is outside this layer.

IsValidValue asks whether a value is valid input: can this value be used to set this thing
(operator, 2026-11-07). It does not ask whether the value is exactly the stored type,
so a plain `[1, 2, 3]` passes for a Vector3 and an integer string passes for a 64-bit
integer. Numeric IsValidValue still checks integer range. Handlers do not validate: the graph
operation calls IsValidValue, and Set does not.

A 64-bit value also takes a plain `[high, low]` pair, in that order. Each word is a
32-bit pattern, signed or unsigned, and Set stores the canonical BigInt, wrapped to the
definition's signedness. Typed-array Set accepts a plain array of any of these forms,
and writes it through convert because native TypedArray.set refuses a pair.

Array Get produces a plain values array. Clone explicitly allocates an owned
independent typed array. Set retains existing typed storage when sizes match;
only variable-length size changes allocate replacement storage. Owners initialise
storage; lazy construction is not introduced here. Overlapping typed views
are copied safely through TypedArray.set after comparison completes.

Specialised path/expression behaviour is still pending. No Float16Array definition is added: it is not in the
runtime's current supported typed-array family.

This subtree imports only its own files and uses JavaScript built-ins. Blue exposure identifiers
are supplied by the future Blue definition adapter, not stored or imported by these handlers.
The existing conversion behavior is retained during relocation; stricter format validation is not
silently adopted.

Options are per call: one reused object for a whole operation, carrying what objects and lists
need, including recursion state, and nothing per member. Object, list and struct handlers
re-enter CjsGraph and return false, or what the change record holds for them; a leaf returns
a boolean, and the graph reads its new value. CjsGraphTypeList holds objects,
CjsGraphTypeValues holds leaf values through an item handler, and CjsGraphTypeMap holds a Map
of names to objects; a Map of leaf values is not implemented. Order counts in a list. A _ref on a structure-list row or an embedded
member holds its object and fills it by value once every source is read.
Ownership edges and operation-owned creations must be recorded before destruction is implemented.
No placeholder Destruct method promises cleanup today.

There are two comparisons, and both compare values in any accepted form, not storage (operator,
2026-11-07). IsEqual is equal within Carbon's tolerances, such as 1e-6 on Float32, and decides whether
Set has anything to do. IsExactEqual is exactly equal, with no tolerance. Both assume valid input.
