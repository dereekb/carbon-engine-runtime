# Independent graph foundation

This subtree imports only its own modules. Blue may use it; it does not load Blue,
CjsSchema, formats, Trinity or the legacy model barrel.

CjsGraph.define(Constructor, definition) registers a stable name and the class's own
member declarations. CjsGraphClassInfo retains a shallow, frozen snapshot in
`declared` and the last derived snapshot in `compiled`. Handler and default value
references are retained, not cloned or instantiated. Defaults must not later be
assigned as shared mutable instance storage.

CjsGraph.getClassInfo(ConstructorOrName) returns that same class-info record and
refreshes its compiled snapshot if registration changed. Consumers must use this
lookup when they need current compiled data; a retained compiled snapshot is
immutable but can be out of date. Replacing a definition retains class-info identity.

Compiled members preserve derived-first order, including same-name alternatives.
`byName[name]` contains those alternatives in that order. Policy filtering must
precede choosing one: Carbon's HIDDEN derived member can leave a base member visible.
No Blue flags are interpreted by the compiler itself.

Registration snapshots member containers and options, validates names before
publication, and invalidates through one revision. Nested metadata/default values
are borrowed declaration data and must not be mutated behind registration; replace
the definition to change them. Compilation never constructs instances or reads their
properties. Access execution, edge compilation, traversal, policies, decorators and
value-operation integration are still pending.

GraphTypes.js exports the sole Carbon VARTYPE enum with unchanged names and values.
The generic handlers are under types/. CjsGraphRoot will be added with working
operation forwards; there are no speculative no-op graph methods here.
