import { assertNonNegativeNumber } from "#utils/validation";
import * as CcpLog from "../../global/logging/ccpLog.js";

/**
 * Tracks JavaScript resource-owner slots and dispatches their cached-data callbacks.
 *
 * @cjs JavaScript has no deterministic destructor or last-reference notification.
 *   One helper belongs to each BlueResMan; the manager supplies activity time and
 *   lease policy. This helper owns only links, not resource loading or eviction.
 *   Explicit owner teardown still unregisters immediately.
 *
 * Native review: BlueAsyncRes.h:23-56 and BlueAsyncRes.cpp:261-368 provide
 * per-resource callbacks; MotherLode.cpp:329-401 handles native last-reference
 * lifetime. BlueResMan.h and IBlueResMan.h have no owner/property lease registry.
 * Native notification methods stay on BlueAsyncRes; this is the browser tracking
 * mechanism behind the manager's existing entry points, not another native type.
 */
export class CjsBlueResManNotify
{
  /** Stable identity for this internal, non-serializable helper. */
  static className = "CjsBlueResManNotify";

  /** Manager diagnostic channel, shared rather than registered again. */
  _channel = null;

  /**
   * Uses the owning manager's diagnostic channel.
   * @implemented
   * @param {CcpLogChannel_t} channel Manager log channel.
   */
  constructor(channel)
  {
    this._channel = channel;
  }

  /** @cjs Persistent owner/resource/holder/key links, compacted during PurgeInactive. */
  _notifyTargets = [];

  /** @cjs Owner and resource index for allocation-free per-use link renewal. */
  _notifyTargetsByOwner = new Map();

  /**
   * Registers an owner's resource property and rebuilds immediately if prepared.
   *
   * Carbon: BlueAsyncRes::AddNotifyTarget (blue/src/BlueAsyncRes.cpp:261-290).
   * @adapted Links live on the manager and expire because JavaScript cannot
   *   guarantee native destructor unregistration. Explicit teardown must still
   *   remove them. Revisit manager ownership once OnDestruct is guaranteed.
   * @param {object} owner Owner implementing Carbon's two cached-data handlers.
   * @param {BlueAsyncRes} resource Resource held by the owner.
   * @param {object|Map} holder Object or map holding the resource.
   * @param {*} key Property name or map key; expiry clears only a matching value.
   * @param {number} now Manager activity time in milliseconds.
   * @returns {void}
   */
  AddNotifyTarget(owner, resource, holder, key, now)
  {
    const isMap = holder instanceof Map;
    if (!holder || (isMap ? holder.get(key) : holder[key]) !== resource)
    {
      throw new TypeError("AddNotifyTarget requires the holder and key holding the resource.");
    }
    let resources = this._notifyTargetsByOwner.get(owner);
    if (!resources) this._notifyTargetsByOwner.set(owner, resources = new Map());
    let entries = resources.get(resource);
    if (!entries) resources.set(resource, entries = []);
    for (let i = 0; i < entries.length; i++)
    {
      if (entries[i].holder === holder && entries[i].key === key)
      {
        entries[i].lastUsed = now;
        return;
      }
    }
    for (let i = 0; i < entries.length; i++) entries[i].lastUsed = now;
    const firstLink = entries.length === 0;
    const entry = { owner, resource, holder, key, isMap, lastUsed: now, active: true };
    entries.push(entry);
    this._notifyTargets.push(entry);
    if (firstLink && resource.IsPrepared()) owner.RebuildCachedData(resource);
  }

  /**
   * Removes every property link between an owner and resource.
   *
   * Carbon: BlueAsyncRes::RemoveNotifyTarget (blue/src/BlueAsyncRes.cpp:292-347).
   * @adapted Manager ownership replaces the native per-resource target list.
   * @param {object} owner Owner replacing or destroying its resource slot.
   * @param {BlueAsyncRes} resource Previously held resource.
   * @returns {void}
   */
  RemoveNotifyTarget(owner, resource)
  {
    const resources = this._notifyTargetsByOwner.get(owner);
    const entries = resources?.get(resource);
    if (!entries) return;
    while (entries.length) this._RemoveNotifyLink(entries[entries.length - 1]);
  }

  /**
   * Renews all of an owner's links to a resource without allocating.
   * @cjs Per-target activity replaces native destructor certainty.
   * @implemented
   * @param {object} owner Resource user.
   * @param {BlueAsyncRes} resource Resource being used.
   * @param {number} now Manager activity time in milliseconds.
   * @returns {boolean} Whether a registered link was renewed.
   */
  _KeepNotifyTargetAlive(owner, resource, now)
  {
    const entries = this._notifyTargetsByOwner.get(owner)?.get(resource);
    if (!entries) return false;
    let renewed = false;
    for (let i = 0; i < entries.length; i++)
    {
      const entry = entries[i];
      if ((entry.isMap ? entry.holder.get(entry.key) : entry.holder[entry.key]) !== resource) continue;
      entry.lastUsed = now;
      renewed = true;
    }
    return renewed;
  }

  /**
   * Returns a detached diagnostic snapshot of links for an owner.
   * @cjs Debugging manager-owned retention without exposing mutable link records.
   * @implemented
   * @param {object} owner Owner to inspect.
   * @returns {object[]} Its active resource/property links.
   */
  GetNotifyTargetsByOwner(owner)
  {
    return this._notifyTargets.filter(entry => entry.active && entry.owner === owner)
      .map(entry => ({ owner: entry.owner, resource: entry.resource, holder: entry.holder, key: entry.key, lastUsed: entry.lastUsed }));
  }

  /**
   * Returns a detached diagnostic snapshot of links for a resource.
   * @cjs Debugging manager-owned retention without exposing mutable link records.
   * @implemented
   * @param {BlueAsyncRes} resource Resource to inspect.
   * @returns {object[]} Its active owner/property links.
   */
  GetNotifyTargetsByResource(resource)
  {
    return this._notifyTargets.filter(entry => entry.active && entry.resource === resource)
      .map(entry => ({ owner: entry.owner, resource: entry.resource, holder: entry.holder, key: entry.key, lastUsed: entry.lastUsed }));
  }

  /**
   * Removes an indexed link before callbacks can re-enter its owner's setter.
   * @cjs A removed record releases its strong references before array compaction.
   * @implemented
   * @param {object} entry Active link.
   * @returns {void}
   */
  _RemoveNotifyLink(entry)
  {
    if (!entry.active) return;
    const resources = this._notifyTargetsByOwner.get(entry.owner);
    const entries = resources.get(entry.resource);
    entries.splice(entries.indexOf(entry), 1);
    if (!entries.length) resources.delete(entry.resource);
    if (!resources.size) this._notifyTargetsByOwner.delete(entry.owner);
    entry.active = false;
    entry.owner = entry.resource = entry.holder = entry.key = null;
  }

  /**
   * Releases an expired link and clears its still-matching owner property.
   * @cjs Revisit aliveness checks once Destruct exists. Explicit Destruct must
   *   remove links; expiry only bounds retention for owners that never clean up.
   *   Assignment deliberately invokes accessors. A callback that replaces the
   *   property must not have its replacement cleared by this expiry.
   * @implemented
   * @param {object} entry Link to expire.
   * @returns {void}
   */
  _ExpireNotifyLink(entry)
  {
    const owner = entry.owner;
    const resource = entry.resource;
    if ((entry.isMap ? entry.holder.get(entry.key) : entry.holder[entry.key]) !== resource)
    {
      const key = entry.key;
      this._RemoveNotifyLink(entry);
      CcpLog.CCP_LOGWARN_CH(this._channel, "Resource owner replaced %s without RemoveNotifyTarget (%s)", String(key), resource.GetPath());
      return;
    }
    const slots = this._notifyTargetsByOwner.get(owner).get(resource)
      .map(link => ({ holder: link.holder, key: link.key, isMap: link.isMap }));
    this.RemoveNotifyTarget(owner, resource);
    owner.ReleaseCachedData(resource);
    for (let i = 0; i < slots.length; i++)
    {
      const { holder, key, isMap } = slots[i];
      if (isMap)
      {
        if (holder.get(key) === resource) holder.delete(key);
      }
      else if (holder[key] === resource) holder[key] = null;
    }
    // A setter can re-register another alias while the remaining slots are
    // still being cleared. Drop only those new links whose slot is now empty;
    // keep a callback's genuinely new resource slot intact.
    const remaining = this._notifyTargetsByOwner.get(owner)?.get(resource)?.slice() ?? [];
    for (const link of remaining)
    {
      if ((link.isMap ? link.holder.get(link.key) : link.holder[link.key]) !== resource)
        this._RemoveNotifyLink(link);
    }
  }

  /**
   * Expires unrenewed owner links independently of whether their resource is busy.
   * @cjs JavaScript has no reliable native last-reference/destructor signal.
   * @implemented
   * @param {number} now Registry activity time in milliseconds.
   * @param {number} seconds Owner-link lifetime supplied by the manager policy.
   * @returns {void}
   */
  _PurgeNotifyTargets(now, seconds)
  {
    assertNonNegativeNumber(seconds, "BlueResMan leaseSeconds");
    const expiry = now - seconds * 1000;
    const entries = this._notifyTargets;
    const count = entries.length;
    for (let i = 0; i < count; i++)
    {
      const entry = entries[i];
      if (entry.active && entry.lastUsed < expiry) this._ExpireNotifyLink(entry);
    }
    let kept = 0;
    for (let i = 0; i < entries.length; i++)
    {
      if (entries[i].active) entries[kept++] = entries[i];
    }
    entries.length = kept;
  }

  /**
   * Rebuilds registered owners after a successful resource preparation.
   * Carbon: BlueAsyncRes::NotifyRebuildCachedData (blue/src/BlueAsyncRes.cpp:354-360).
   * @adapted The manager owns the links instead of the resource.
   * @param {BlueAsyncRes} resource Prepared resource.
   * @returns {void}
   */
  _NotifyRebuildCachedData(resource)
  {
    this._NotifyTargets(resource, true);
  }

  /**
   * Releases registered owners' derived data before reload or after failure.
   * Carbon: BlueAsyncRes::NotifyReleaseCachedData (blue/src/BlueAsyncRes.cpp:362-368).
   * @adapted Links remain registered for the next completed attempt.
   * @param {BlueAsyncRes} resource Resource losing its prepared data.
   * @returns {void}
   */
  _NotifyReleaseCachedData(resource)
  {
    this._NotifyTargets(resource, false);
  }

  /**
   * Dispatches a stable notification walk, once per owner/resource pair.
   * @cjs Revisit aliveness checks once Destruct exists. Until explicit teardown
   *   removes a dead owner's links, the manager retains it until lease expiry.
   * @implemented
   * @param {BlueAsyncRes} resource Resource whose state changed.
   * @param {boolean} prepared True for rebuild, false for release.
   * @returns {void}
   */
  _NotifyTargets(resource, prepared)
  {
    const entries = this._notifyTargets.filter(entry => entry.active && entry.resource === resource);
    const notified = new Set();
    for (let i = 0; i < entries.length; i++)
    {
      const entry = entries[i];
      if (!entry.active) continue;
      const owner = entry.owner;
      if ((entry.isMap ? entry.holder.get(entry.key) : entry.holder[entry.key]) !== resource)
      {
        this._ExpireNotifyLink(entry);
        continue;
      }
      if (notified.has(owner)) continue;
      notified.add(owner);
      if (prepared) owner.RebuildCachedData(resource);
      else owner.ReleaseCachedData(resource);
    }
  }

  /**
   * Detaches every owner slot before an idle resource is purged.
   * @cjs Manager eviction cannot leave a surviving owner using stale derived data.
   * @implemented
   * @param {BlueAsyncRes} resource Resource being purged.
   * @returns {void}
   */
  _ExpireResourceNotifyTargets(resource)
  {
    const entries = this._notifyTargets.filter(entry => entry.active && entry.resource === resource);
    for (let i = 0; i < entries.length; i++)
    {
      if (entries[i].active) this._ExpireNotifyLink(entries[i]);
    }
  }

  /**
   * Releases registered owners and clears their matching slots during manager teardown.
   * @implemented
   * @returns {void}
   */
  Clear()
  {
    const links = this._notifyTargets.slice();
    for (let i = 0; i < links.length; i++)
    {
      if (links[i].active) this._ExpireNotifyLink(links[i]);
    }
    this._notifyTargets.length = 0;
  }
}
