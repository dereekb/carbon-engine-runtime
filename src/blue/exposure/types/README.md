# Standalone value handlers

These handlers are not registered with Blue or connected to the current readers,
writers or schema. Object, list and struct classes remain placeholders.

`CjsScalarType` shares property access and instance shortcuts. Float32, Float64,
boolean and string specialisations supply storage identity and conversion.
`CjsFloat32ArrayType` overrides array value operations. It accepts a property
options record with `length` (`-1` for variable length); an instance's fields are
its default options. It does not allocate a handler per property.

Static operations are `get(target, key)`, `set(target, key, value, options)`,
`copy(source, sourceKey, target, key, options)`, `clone(target, key)`, `is(value)`,
`isExactEqual(a, b)` and `isEqual(a, b)`. Instance shortcuts capitalise the same
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
