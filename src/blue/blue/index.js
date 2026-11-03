// Ports of Carbon's two Blue libraries, which live side by side here because
// every subsystem uses both:
//
//   - blueexposure (blueexposure/): the class-exposure and object-model layer.
//     BlueClasses / IBlueClasses, Copier / ICopier /
//     ICopierCustomAssignment, BlueList, ICustomPersist, IInitialize, IList,
//     IListNotify and INotify.
//   - blue (blue/): the runtime services. The OS and clock interfaces
//     (IBlueOS, BlueOS, BeInfo, IBlueEvents, ICatchupTicks, IVariableTicker,
//     ISimTimeRebaseNotify), paths, the resource manager and file systems
//     (IBlueResMan, BlueResMan, MotherLode, ICacheable, IBlueResFileSystem,
//     BlueResFileSystemRemote, BlueResFileSystemLocal, CjsBlueResFileSystemFetch,
//     CjsBlueResFileSystemCallback,
//     BlueFileUtil, RemoteFileCache), object metadata, placement
//     observers, the lazy object holder (BlueObjectProxy, IBlueObjectProxy,
//     IBlueObjectBuilder, IUnloadable), the ITri* curve/function interfaces,
//     ICurveSetDriver, and the
//     red/black readers and writers (IRootReader*, IRootWriter, DictReader,
//     YamlWriter).
//
// CcpTime and CcpDateTime port core/include/CcpTime.h. Files with no Carbon
// header of the same name (BlueScriptCallback,
// CjsFormatStore, CjsLoadingObject, the lowercase helper modules) state their
// donor, or that they have none, in their own headers.
//
// NO DECORATOR SYNTAX IN THIS FOLDER. package.json maps BOTH `#blue` and the
// public `./blue` export to this file in `src`, not to the build, so
// `@carbonenginejs/runtime/blue` is raw source - and the tests that import it
// that way cannot parse an `@`. A decorator here fails as
// `SyntaxError: Invalid or unexpected token` in a test that looks unrelated.
// Use `CjsSchema.define` and `CjsSchema.decorateMethod` at the foot of the
// file, as every class here does. This is a packaging constraint, not a
// preference, and it does not contradict the decorator direction elsewhere.

/**
 * Native resource flags and persistent notifications live on BlueAsyncRes.
 * resMan owns pending promises and plain/object data; concrete resources own
 * their decoded family data. Only a policy purge permits implicit revival.
 */

export * from "../blueexposure/BlueScriptCallback.js";
export * from "./interfaces/IBlueDynamicResourceConstructor.js";
export * from "./BeInfo.js";
export * from "./interfaces/IBlueEvents.js";
export * from "./interfaces/IBlueEventListener.js";
export * from "./interfaces/IBluePlacementObserver.js";
export * from "./interfaces/PositionDescription.js";
export * from "./interfaces/IBlueMultiPlacementObserver.js";
export * from "./interfaces/IVariableTicker.js";
export * from "./interfaces/ICatchupTicks.js";
export * from "./interfaces/ISimTimeRebaseNotify.js";
export * from "./interfaces/IBlueOS.js";
export * from "./BlueOS.js";
export * from "./CcpDateTime.js";
export * from "./CcpTime.js";
export * from "./interfaces/IBlueResMan.js";
export * from "./interfaces/IBlueResManNotifications.js";
export * from "./interfaces/IBlueResource.js";
export * from "./interfaces/IBlueAsyncResNotifyTarget.js";
export * from "./BlueAsyncRes.js";
export * from "../blueexposure/IPythonMethods.js";
export * from "./interfaces/ICacheable.js";
export * from "../blueexposure/IRoot.js";
export * from "../blueexposure/IInitialize.js";
export * from "./interfaces/IUnloadable.js";
export * from "./interfaces/IBlueObjectBuilder.js";
export * from "./interfaces/IBlueObjectProxy.js";
export * from "./BlueObjectProxy.js";
export * from "./interfaces/ICurveSetDriver.js";
export * from "./interfaces/ITriFunction.js";
export * from "./interfaces/ITriScalarFunction.js";
export * from "./interfaces/ITriVectorFunction.js";
export * from "./interfaces/ITriQuaternionFunction.js";
export * from "./interfaces/ITriColorFunction.js";
export * from "./interfaces/ITriCurveLength.js";
export * from "../blueexposure/IList.js";
export * from "../blueexposure/BlueList.js";
export * from "../blueexposure/IListNotify.js";
export * from "../blueexposure/INotify.js";
export { NotifyModified } from "../compose/values.js";
export * from "./interfaces/IBlueResFileSystem.js";
export * from "./io/RemoteFileCache.js";
export * from "./io/BlueResFileSystemRemote.js";
export * from "./io/BlueResFileSystemLocal.js";
export * from "./io/CjsBlueResFileSystemFetch.js";
export * from "./io/CjsBlueResFileSystemCallback.js";
export * from "./BlueFileUtil.js";
export * from "./BluePaths.js";
export * from "./interfaces/IBlueCallbackMan.js";
export * from "./BlueCallbackMan.js";
export * from "./BlueCallbackManTicker.js";
export * from "./interfaces/IBlueThreadMonitor.js";
export * from "./BlueThreadMonitor.js";
export * from "./ScopedThreadStatus.js";
export * from "./worker/BlueCallbackManWorker.js";
// The resource manager core: Carbon's BlueResMan, BlueAsyncRes and MotherLode
// live in Blue, and so does ours. Formats and concrete resources stay in
// resource and register with it.
export * from "../../global/consts/resourceHandlerMode.js";

export * from "./CjsFormatStore.js";

export * from "./CjsLoadingObject.js";
export * from "./MotherLode.js";
export * from "./worker/CjsResManMainThreadLoader.js";
export * from "./worker/CjsResManWorkerLoader.js";
export * from "./BlueResMan.js";
export * from "./interfaces/IBluePaths.js";
export * from "../blueexposure/IBlueClasses.js";
export * from "../blueexposure/BlueClasses.js";
export { ClassInfo } from "../blueexposure/ClassInfo.js";
export { VarEntry } from "../blueexposure/VarEntry.js";
export { BlueRttiType } from "../blueexposure/BlueRttiType.js";
export * from "../blueexposure/ICopier.js";
export * from "../blueexposure/ICopierCustomAssignment.js";
export * from "../blueexposure/ICustomPersist.js";
export * from "../blueexposure/Copier.js";
export { CjsBlue } from "./CjsBlue.js";
export { blue } from "./blue.js";
export { CjsBlueEnumRegistry, EnumRegistrationType } from "./enums/CjsBlueEnumRegistry.js";
// The values engine: Blue's dictionary reader and a writer modelled on YamlWriter.
export * from "./interfaces/IBlueObjectMetadata.js";
export * from "./BlueObjectMetadata.js";
export * from "./IRootReader.js";
export * from "./IRootReaderException.js";
export * from "./InvalidAttributeException.js";
export * from "./IRootReaderBase.js";
export * from "./DictReader.js";
export * from "./IRootWriter.js";
export * from "./DictWriter.js";
export * from "./YamlWriter.js";
export * from "./YamlReader.js";

export { GetResources } from "./getResources.js";

export * from "./interfaces/ITriObserverLocal.js";

import "./values.js";

// Composition owns the concrete manager dependency. The holder module imports
// no manager or resource implementation, so resources and MotherLode can use
// its live references without an import cycle or deferred constructor lookup.
import { blue } from "./blue.js";
import { BlueResMan } from "./BlueResMan.js";
blue.resMan = new BlueResMan();
