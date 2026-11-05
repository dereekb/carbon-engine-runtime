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
properties. Generic decorators and value-operation integration are still pending.

`CjsGraph.traverse(root, visit, options)` follows declared object edges, once per
object, depth-first in declaration/list order. A member's `edge` declares `kind`
(`embed`, `ref`, `weak`), optional child `type` (constructor or registered name), and
`collection: true` for an array of children. Without an edge, the member is a leaf
and traversal does not read its value. `key` selects storage and optional `index`
selects an array slot. Missing/undefined edges, invalid slots and unknown dynamic
classes fail; explicit null object edges are absent. Plain structs use their declared
type; class instances resolve their actual registered type from the prototype.

The default follows embed/ref; `options.edges` may also include weak.
`options.acceptMember(member, classInfo)` filters candidates before inherited name
resolution, once per encountered class. Eligibility must be class-level and stable
for the call. A selected leaf shadows a same-name base edge. The synchronous visitor
receives `(object, classInfo)` and may return false to skip its descendants. Traversal
returns the visited count. Callbacks must not change declarations or graph topology;
registration changes fail rather than continue with a mixture of descriptions.

Nested traversals use separate reusable stacks and weak pass-mark tables by active
call depth. This supports plain registered instances without adding `__cjs` fields,
and avoids nested passes overwriting outer marks. Completed/failed frames release
graph references; weak keys do not retain visited objects. These enumeration marks
are not the reference/update tables required by future Set and serialization.

## Cached selection

`CjsGraph.compileSelection({ matchClass, acceptMember?, edges? }, diagnostics?)`
snapshots a selection description and compiles its eligible members and class
reachability. Matchers and member filters are class-only predicates, stable for the
selection lifetime. If their meaning changes, create a new selection. Registration
and definition replacement automatically invalidate derived selection tables.
Prototype inheritance must also remain stable until the class is registered again.

`CjsGraph.select(root, selection, output, options?)` appends matching identities to
the caller's array in DFS order and returns that array. It does not fetch resources
or assume a particular resource base class; the supplied matcher identifies those
classes. Both full and pruned selection run through the same traversal engine.
Set `options.prune: false` for the full reference walk. A matching object can itself
contain further matches, so it does not stop descent. Failure leaves partial output
intact and releases traversal state; there is no transactional rollback.

Reachability includes registered subclasses of a declared target. Dynamic and
unregistered target types remain conservative, including through class cycles.
An optional diagnostics array receives class/member/reason records during explicit
compilation, or via `options.diagnostics` during a registration-triggered rebuild.
No diagnostic records are created by default. Optional `options.stats` is reset per
call with visited/matched counts, skipped declared edges and compiledClasses (zero
on warm calls). Compilation's dependency lists are discarded after the table is built.

The selection contract requires valid declared storage. Typed object edges must be
assignable to their declared class. A shared plain struct must have one canonical
declared class across all incoming edges; it cannot represent two class views.
Full traversal checks these constraints even for identities already visited.
Pruning deliberately does not read excluded branches, so it is not a graph validator.
Use full traversal when validating declared edge storage. Neither path permits topology or
declaration mutation during a walk. There is no global traversal policy yet.

GraphTypes.js exports the sole Carbon VARTYPE enum with unchanged names and values.
The generic handlers are under types/. CjsGraphRoot will be added with working
operation forwards; there are no speculative no-op graph methods here.
