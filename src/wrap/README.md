# Application wrappers

`TnyShip.fetch(library, dnaOrPath)` acquires a live ship through `CjsLibrary.Fetch`
and starts its native controllers once for that acquisition. It does not repeat
graph initialization, provide resource readiness, or implement ship behavior.
The explicit library must already be initialized and pumped by its host.

`TnyScene.fetch(library, path)` acquires an authored space scene, while
`TnyScene.fromWrapped(library, scene)` adapts an existing one. Both preserve the
scene graph. `AddObject(ship)` and `RemoveObject(ship)` use its native object list
and notifications. Duplicate addition and missing removal return false; removal
does not destroy the ship. Wrappers from another library are rejected.

Both wrappers expose `library` and `wrapped` references. They borrow these
objects and own no frame loop or library shutdown. This first surface supports
`EveShip2` and `EveSpaceScene`; character and modular-ship operations are separate
work. Acquisition/type failures reject, without a replacement scene or ship.
