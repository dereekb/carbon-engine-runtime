import { TnyDatabase } from "./TnyDatabase.js";
import { TnyStorage } from "./TnyStorage.js";
import { TnyServices } from "./TnyServices.js";

/**
 * Shader models by the effect-path name the library configuration takes
 * (`#utils/effectPath` ShaderModelSuffixes), as Tr2Renderer.SetShaderModel takes them.
 */
const SHADER_MODELS = { lo: "TR2SM_3_0_LO", low: "TR2SM_3_0_LO", hi: "TR2SM_3_0_HI", medium: "TR2SM_3_0_HI",
  high: "TR2SM_3_0_DEPTH", depth: "TR2SM_3_0_DEPTH" };

/**
 * Our orchestration owner. Construction is inert and importable without Blue,
 * rendering or a browser; only `Initialize` loads the engine, by dynamic import.
 * Ours, with no Carbon counterpart: the EVE client starts its device and scene
 * in proprietary client code.
 */
export class Tny
{
    static className = "Tny";

    _storage = null;
    _services = null;
    _database = null;
    _closing = null;

    /** The library Initialize created; null before it and after Close. */
    library = null;

    /** The library's device backend (CjsBrowserBackend), owned by the library; null before Initialize. */
    backend = null;

    /** The TnyScene being drawn; null before Initialize. */
    scene = null;

    /** The scene driver's camera (EveCamera); null before Initialize. */
    camera = null;

    /** The scene render driver (EveSpaceSceneRenderDriver); null before Initialize. */
    driver = null;

    /** Device pixels per CSS pixel the canvas is sized at, read every frame. */
    pixelRatio = 1;

    /** The first error a frame threw, kept for inspection; later frames still run. */
    frameError = null;

    /** Replaces the default scene draw when set: called as `(tny)` inside the frame's render job. */
    _renderHandler = null;

    /** The render job holding the frame's draw step, while the loop runs. */
    _job = null;

    /** The device's render jobs the frame job was added to. */
    _jobs = null;

    /** The requestAnimationFrame id, while the loop runs. */
    _frame = 0;

    /** Engine modules Initialize loaded. */
    _engine = null;

    /** Construct inert storage, service and database owners from host options. */
    constructor({ storage = {} } = {})
    {
        this._storage = new TnyStorage(storage);
        this._services = new TnyServices(this._storage);
        this._database = new TnyDatabase(this._services);
    }

    /** Return the table registry owned by this host. */
    get database() { return this._database; }

    /** Return the storage manager owned by this host. */
    get storage() { return this._storage; }

    /** Return the service registry owned by this host. */
    get services() { return this._services; }

    /**
     * Starts the engine on a canvas: a CjsLibrary acquires WebGPU or WebGL2 and
     * that backend's effects, initializes, attaches Trinity; then this
     * installs a scene driver and camera, starts the one frame loop, then loads
     * the scene. Success means the backend and scene are ready and the loop is
     * running. A failure unwinds what started and rejects.
     *
     * @param {object} options Start-up options.
     * @param {HTMLCanvasElement} options.canvas The canvas to draw to.
     * @param {object} [options.resources] `CjsBlueResFileSystemFetch` options (`paths`, `pathResolver`) for `res:`.
     * @param {string[]} [options.preference] Backends to try, default `["webgpu", "webgl2"]`.
     * @param {string|null} [options.scene] An EveSpaceScene resource path; omitted, an empty EveSpaceScene.
     * @param {object} [options.configuration] CjsLibrary configuration; its `effects` replace the backend's.
     * @param {object} [options.services] Providers passed to CjsLibrary.Initialize.
     * @param {string} [options.shaderModel="depth"] Shader model: lo, hi or depth.
     * @param {"opaque"|"premultiplied"} [options.alphaMode="opaque"] Canvas compositing.
     * @param {number} [options.pixelRatio] Device pixels per CSS pixel, default the window's.
     * @returns {Promise<Tny>} This host.
     */
    async Initialize({ canvas, resources = null, preference, scene = null, configuration = {}, services = {},
        shaderModel = "depth", alphaMode = "opaque", pixelRatio = globalThis.devicePixelRatio || 1 } = {})
    {
        if (this.library) throw new Error("Tny is already initialized.");
        if (!canvas) throw new TypeError("Tny.Initialize requires a canvas.");
        if (!Object.hasOwn(SHADER_MODELS, shaderModel)) throw new RangeError(`Unknown shader model ${JSON.stringify(shaderModel)}.`);

        const engine = this._engine = await LoadEngine();
        this.pixelRatio = pixelRatio;

        try
        {
            const library = this.library = new engine.CjsLibrary(configuration);
            this.backend = await library.AcquireBackend({ canvas, preference, alphaMode, shaderModel });
            if (resources) library.SetConfiguration({ paths: { tny: new engine.CjsBlueResFileSystemFetch(resources) } });
            await library.Initialize(services);

            library.AttachTrinity({ renderContextAL: this.backend.al, backend: this.backend.name });
            engine.Tr2Renderer.SetShaderModel(engine.TR2SHADERMODEL[SHADER_MODELS[shaderModel]]);

            this.driver = engine.createSpaceSceneDriver();
            this.camera = this.driver.camera = new engine.EveCamera();
            this._Start();

            this.SetScene(scene ? await engine.TnyScene.fetch(scene) : engine.TnyScene.fromWrapped(CreateEmptyScene(engine)));
            return this;
        }
        catch (error)
        {
            try { await this._Stop(); }
            catch (cleanupError) { throw new AggregateError([ error, cleanupError ], "Tny startup and its cleanup failed", { cause: error }); }
            throw error;
        }
    }

    /**
     * Draws another scene from the next frame. The previous scene is not destroyed.
     *
     * @param {TnyScene} scene The scene to draw.
     */
    SetScene(scene)
    {
        this.scene = scene;
        this.driver.scene = scene.wrapped;
    }

    /**
     * Replaces the default scene draw. The handler runs inside the device's
     * render job each frame, after Blue's tick; it may call `RenderScene`.
     *
     * @param {Function|null} handler Called as `(tny)`; null restores the default.
     */
    SetRenderHandler(handler)
    {
        this._renderHandler = handler;
    }

    /** Draws the scene through the driver into the canvas: the default frame. */
    RenderScene()
    {
        const { blue, Tr2RenderContext_GetMainThreadRenderContext } = this._engine;
        this.backend.Render(this.driver, blue.os.GetRealTime(), blue.os.GetCurrentFrameTime(), Tr2RenderContext_GetMainThreadRenderContext());
    }

    /** Return the shared promise for closing this host once. */
    Close()
    {
        if (!this._closing) this._closing = this._Close();
        return this._closing;
    }

    /**
     * Stop the engine, then close the database, services and storage in order,
     * and aggregate shutdown errors.
     */
    async _Close()
    {
        const errors = [];
        try { await this._Stop(); }
        catch (error) { errors.push(error); }
        await this._database.Close();
        try { await this._services.Close(); }
        catch (error) { errors.push(error); }
        try { await this._storage.Close(); }
        catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "Tny shutdown failed");
    }

    /**
     * Adds the frame's draw to the device's recurring render jobs and starts
     * pumping Blue once per animation frame. Trinity is registered for Blue's
     * tick (trinity.Initialize) and runs the device's jobs, so the draw happens
     * inside PumpOS; the scene driver updates the scene and camera itself.
     */
    _Start()
    {
        const { Tr2RenderJobs, TriRenderJob, TriStepPythonCB, blue, trinity } = this._engine;
        const device = trinity.device;
        const step = new TriStepPythonCB();

        step.SetCallback(() => this._Draw());
        this._job = new TriRenderJob();
        this._job.name = "Tny";
        this._job.steps.push(step);
        this._jobs = device.GetRenderJobs() ?? new Tr2RenderJobs();
        this._jobs.recurring.push(this._job);
        device.SetRenderJobs(this._jobs);

        const tick = () =>
        {
            // The next frame first, so a throw out of PumpOS does not end the loop.
            this._frame = globalThis.requestAnimationFrame(tick);
            this._FitCanvas();
            blue.os.PumpOS();
        };
        this._frame = globalThis.requestAnimationFrame(tick);
    }

    /** One frame's draw; a failure is kept and logged once, and later frames still run. */
    _Draw()
    {
        try
        {
            if (this._renderHandler) this._renderHandler(this);
            else this.RenderScene();
        }
        catch (error)
        {
            if (!this.frameError) console.error("Tny: first failed frame", error);
            this.frameError ??= error;
        }
    }

    /** Keeps the canvas back buffer at its displayed size times `pixelRatio`. */
    _FitCanvas()
    {
        const canvas = this.backend.canvas;
        const width = Math.max(1, Math.round(canvas.clientWidth * this.pixelRatio));
        const height = Math.max(1, Math.round(canvas.clientHeight * this.pixelRatio));
        const device = this._engine.trinity.device;

        // The backend creates the AL device directly rather than through
        // TriDevice.CreateDevice, which records these (TriDevice.cpp).
        device.width = width;
        device.height = height;
        if (width !== canvas.width || height !== canvas.height) this.backend.Resize(width, height);
    }

    /** Stops the loop, removes the frame job and shuts the library down, which releases its backend. */
    async _Stop()
    {
        if (this._frame) globalThis.cancelAnimationFrame(this._frame);
        this._frame = 0;
        if (this._job)
        {
            const index = this._jobs.recurring.indexOf(this._job);
            if (index >= 0) this._jobs.recurring.splice(index, 1);
            this._job = null;
        }
        const library = this.library;
        this.library = null;
        this.scene = this.camera = this.driver = null;
        this.backend = null;
        if (library) await library.Shutdown();
    }
}

/** Loads the engine modules Initialize composes; Tny itself imports none. */
async function LoadEngine()
{
    const [ core, driver, fetchFs, blueIndex, consts, trinityIndex, renderJob, camera, scene, tnyScene ] = await Promise.all([
        import("../../core/CjsLibrary.js"),
        import("../../core/scene/createSpaceSceneDriver.js"),
        import("../../blue/io/CjsBlueResFileSystemFetch.js"),
        import("../../blue/index.js"),
        import("../../global/consts/graphics/trinityEnums.js"),
        import("../../trinity/index.js"),
        import("../../trinity/renderJob/index.js"),
        import("../../trinity/eve/camera/EveCamera.js"),
        import("../../trinity/eve/scene/EveSpaceScene.js"),
        import("../TnyScene.js")
    ]);
    return {
        CjsLibrary: core.CjsLibrary,
        createSpaceSceneDriver: driver.createSpaceSceneDriver,
        CjsBlueResFileSystemFetch: fetchFs.CjsBlueResFileSystemFetch,
        blue: blueIndex.blue,
        TR2SHADERMODEL: consts.TR2SHADERMODEL,
        trinity: trinityIndex.trinity,
        Tr2Renderer: trinityIndex.Tr2Renderer,
        Tr2RenderContext_GetMainThreadRenderContext: trinityIndex.Tr2RenderContext_GetMainThreadRenderContext,
        Tr2RenderJobs: renderJob.Tr2RenderJobs,
        TriRenderJob: renderJob.TriRenderJob,
        TriStepPythonCB: renderJob.TriStepPythonCB,
        EveCamera: camera.EveCamera,
        EveSpaceScene: scene.EveSpaceScene,
        TnyScene: tnyScene.TnyScene
    };
}

/** An empty space scene, initialized against the attached device. */
function CreateEmptyScene(engine)
{
    const scene = new engine.EveSpaceScene();
    scene.Initialize(engine.Tr2RenderContext_GetMainThreadRenderContext());
    return scene;
}
