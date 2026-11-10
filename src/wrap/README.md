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
`tny.Focus(object, { animate, from })` and `tny.SetInteractive(on)`. The
camera follows a focused object. Wheel and keys need the canvas focusable
(`tabindex`).

**Values.** A wrapper declares what its object exposes. `GetTypeInfo()` has
Carbon's shape, made for this instance (class `TnyShip_<id>`, its Tny layers and
capabilities as interfaces, supported members with flags, ranges and
choices). `GetValues()` returns every member; null means unsupported.
`SetValues(values)` pushes changes to the native owners and calls
`_onModified(name)`. Ships add speed (driving a Destiny ball given with `SetBall`), states, stance,
kill marks and booster members. `controllers` and `overlays` show what those
owners expose.

**Hangars.** `TnyHangar.fetch({ dna, scene })` builds a hangar (`TnyHangar.defaults`
lists the known ones) and its bays: layout placements, a capital
`ship_placement`, or the origin. `SetShip(ship, { bay, entry })` hands the ship
to the content's docker (or `me_generic_hangar_vfx_01a`); `Undock`, `GetShip`,
`GetBays`, `GetCameraPoint`, `controllers`.

**Weapons.** `slots` lists `TnySlot`s from the hull's weapon locators; writing
a slot's `resPath` mounts or unmounts, and `SetTarget`, `Fire`, `Idle`,
`Reload` and `Deactivate` act.

**Settings.** `tny.GetSettings()`, `GetSetting(name)`, `SetSetting(name, value)`
with the library's availability.
