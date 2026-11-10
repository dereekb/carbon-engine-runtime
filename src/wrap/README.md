# Application wrappers (Tny)

A user interface talks only to these wrappers; they delegate to the native
owners and add no engine behaviour.

**Start.** `await new Tny().Initialize({ canvas, resources })`: the library
acquires WebGPU or WebGL2, Trinity attaches, a scene driver and `EveCamera`
are installed, and one frame loop pumps Blue. `Close()` undoes it.

**Environment.** `tny.LoadScene(path)` swaps the scene and carries the shown
objects across. `scene.SetPostProcess(nameOrPath | null)` sets the default post
process from a shipped environment template, or restores the authored one.

**Objects.** `TnySpaceObject`, `TnyMobile`, `TnyShip` and `TnyStationary`
mirror the native classes. `X.fetch({ dna | resPath, awaitResources, name })`
acquires through `CjsLibrary.Fetch` and starts the controllers;
`scene.Fetch(options)` picks the most specific wrapper and adds it.
`AddObject`/`RemoveObject` use the scene's native list.

**Camera.** `tny.controls` (`TnyCameraControls` over the driver's camera),
`tny.Focus(object, { animate })` and `tny.SetInteractive(on)`. The camera
follows a focused object as it moves.

**Parameters.** `GetParameters()`, `GetParameter(name)`, `SetParameter(name,
value)`: only what the object supports, under native names where it has them
(dirtLevel, activationStrength, the three damages, module animations, cloak;
on ships speed, maxSpeed, kill marks, booster values). `speed` moves the ship.

**States and controllers.** `ship.GetStates()`/`SetState(name)`: standard,
warp and dock always, siege and attack where its controllers declare them.
`GetStances()`/`SetStance(value)`. `object.controllers` (`TnyControllers`)
shows only what the controllers expose; `object.overlays` (`TnyOverlays`)
lists, adds and removes mesh overlays.

**Weapons.** `ship.GetSlots()` returns `TnySlot`s from the hull's weapon
locators: `Mount(resPath, { faction })`, `Unmount`, `SetTarget`, `Fire`,
`Idle`, `Reload`, `Deactivate`.

**Settings.** `tny.GetSettings()`, `GetSetting(name)`, `SetSetting(name, value)`
with the library's availability.
