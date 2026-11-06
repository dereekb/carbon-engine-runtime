# Standalone value handlers

These handlers are not registered with Blue or connected to the current readers,
writers or schema. Object, list and struct classes remain placeholders.

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

All typed-array definitions extend `CjsGraphTypeArray`. They select the storage
constructor, scalar element conversion and comparison policy. The base owns the
loops, reads, writes, cloning and storage reuse. Uint8ClampedArray supplies its
own saturating, ties-to-even conversion. Conversion must match the selected
constructor because writes use native TypedArray.set, including its overlap safety.
No temporary typed array is allocated to round or compare a value.

Arrays accept a property options record with `length` (`-1` for variable length);
an instance's fields are its default options. No handler is allocated per property.

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

Named math definitions, specialised path/expression behaviour and graph-value
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
