# Application wrappers

`TnyShip.fetch(dnaOrPath)` acquires a live ship through `CjsLibrary.Fetch`
and starts its native controllers once for that acquisition. It does not repeat
graph initialization, provide resource readiness, or implement ship behavior.
The single shared library must already be initialized and pumped by its host.
`CjsLibrary.instance` exposes that initialized root; it is null during startup
and after shutdown. The wrappers do not create another library.

`TnyScene.fetch(path)` acquires an authored space scene, while
`TnyScene.fromWrapped(scene)` adapts an existing one. Both preserve the
scene graph. `AddObject(ship)` and `RemoveObject(ship)` use its native object list
and notifications. Duplicate addition and missing removal return false; removal
does not destroy the ship.

Both wrappers expose the borrowed `wrapped` graph and own no frame loop or
library shutdown. This first surface supports
`EveShip2` and `EveSpaceScene`; character and modular-ship operations are separate
work. Acquisition/type failures reject, without a replacement scene or ship.
