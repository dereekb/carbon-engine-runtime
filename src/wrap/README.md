# Application wrappers

`await new Tny().Initialize({ canvas, resources })` starts the engine on a
canvas: the library acquires WebGPU or WebGL2, Trinity attaches, a scene
driver and `EveCamera` are installed, and one frame loop pumps Blue. Without
it, a host that already runs the engine can use the wrappers below directly.

`TnyShip.fetch({ dna | resPath, awaitResources, name })` acquires a live ship
through `CjsLibrary.Fetch` and starts its native controllers once.
`awaitResources` waits on `BlueResMan.Watch`. `CjsLibrary.instance` is the
initialized library; it is null during startup and after shutdown.

`TnyScene.fetch(path)` acquires an authored space scene;
`TnyScene.fromWrapped(scene)` adapts an existing one. `AddObject(ship)` and
`RemoveObject(ship)` use the scene's native list; duplicates and absent
removals return false, and removal does not destroy the ship.

Wrappers expose the borrowed `wrapped` graph. Failures reject, without a
replacement scene or ship.
