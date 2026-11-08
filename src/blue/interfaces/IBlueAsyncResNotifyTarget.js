// Source: blue/include/BlueAsyncRes.h:23-28
import { CjsSchema, meta } from "#schema";

/**
 * Receives notifications from an asynchronously loaded resource.
 *
 * Carbon: IBlueAsyncResNotifyTarget (blue/include/BlueAsyncRes.h:23-28)
 *
 * A plain C++ interface, not a Blue one: Carbon never exposes it, so it carries
 * no exposure. `BlueAsyncRes` calls `RebuildCachedData` when a load finishes
 * (or at once, for a target added to a prepared resource) and
 * `ReleaseCachedData` before a reload. Ours adds `RemoveCachedData`, for a
 * holder letting go of a resource for good.
 */
export class IBlueAsyncResNotifyTarget
{
  /**
   * `ReleaseCachedData( BlueAsyncRes* p )` - drop data derived from the resource.
   *
   * @abstract
   * @param {import("../resman/BlueAsyncRes.js").BlueAsyncRes} _resource The notifying resource.
   */
  ReleaseCachedData(_resource) {}

  /**
   * `RebuildCachedData( BlueAsyncRes* p )` - rebuild data derived from the resource.
   *
   * @abstract
   * @param {import("../resman/BlueAsyncRes.js").BlueAsyncRes} _resource The notifying resource.
   */
  RebuildCachedData(_resource) {}

  /**
   * Ours: lets go of a resource for good: releases what was derived from it,
   * empties every slot holding it, and removes the holder's notify link. The
   * resource manager calls it when a link expires (Carbon never expires a
   * resource), and a holder's Destruct calls it for each resource it holds,
   * where Carbon's destructor calls RemoveNotifyTarget. One method does the
   * whole release, so it is never repeated.
   *
   * @cjs
   * @abstract
   * @param {import("../resman/BlueAsyncRes.js").BlueAsyncRes} _resource The resource let go of.
   */
  RemoveCachedData(_resource) {}
}

CjsSchema.decorateMethod(IBlueAsyncResNotifyTarget, "ReleaseCachedData", meta.abstract);
CjsSchema.decorateMethod(IBlueAsyncResNotifyTarget, "RebuildCachedData", meta.abstract);
CjsSchema.decorateMethod(IBlueAsyncResNotifyTarget, "RemoveCachedData", meta.abstract);
CjsSchema.meta.carbon("IBlueAsyncResNotifyTarget")(IBlueAsyncResNotifyTarget);
