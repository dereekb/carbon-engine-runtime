# Standalone value handlers

These handlers are not registered with Blue or connected to the current readers,
writers or schema. Object, list and struct classes remain placeholders.

`CjsGraphTypeScalar` shares property access and instance shortcuts. Float32, Float64,
boolean and string specialisations supply storage identity and conversion.
`CjsGraphTypeFloat32Array` overrides array value operations. It accepts a property
options record with `length` (`-1` for variable length); an instance's fields are
its default options. It does not allocate a handler per property.

Static operations are `get(target, key, options)`, `set(target, key, value, options)`,
`copy(source, sourceKey, target, key, options)`, `clone(target, key, options)`, `is(value)`,
`isExactEqual(a, b)` `isEqual(a, b)` and `isLike(a, b, options)`. Instance shortcuts capitalise the same
names. There is no From, schema lookup, accessor resolution or destruction.

Set/Copy report an exact change after destination conversion. This is a JS
convenience, unlike Carbon Copy's success result. IsEqual applies native
comparison semantics; it does not decide whether to assign. In particular,
Carbon's float-array NaN comparison quirk is retained.

Array Get produces a plain values array. Clone explicitly allocates an owned
independent typed array. Set retains existing typed storage when sizes match;
only variable-length size changes allocate replacement storage. Fixed-length
sources and destinations must match the declared count. Owners initialise
storage; lazy construction is not introduced here. Overlapping typed views
are copied safely through TypedArray.set after comparison completes.

Integer widths, additional array representations, named math definitions,
specialised path/expression behaviour and graph-value handlers are still pending.

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
