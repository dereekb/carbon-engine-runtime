// Blue's rules for the independent graph: a policy decides, and the graph walks.
import { BLUELISTEVENT } from "#consts/blue";
import { CjsSchema } from "#schema";
import { GraphOperation } from "../../../global/model/graph/index.js";
import { mappedInterfaces } from "../../compose/interface.js";
import { isExportableField, isWritableField } from "../../compose/values.js";
import { IInitialize } from "../../exposure/IInitialize.js";
import { IList } from "../../exposure/IList.js";
import { IListNotify } from "../../exposure/IListNotify.js";
import { INotify } from "../../exposure/INotify.js";

/**
 * Blue's rules for the graph: which members, and what an object is told.
 * @cjs Our policy over the graph's two hooks. It decides and never walks.
 */
export class CjsBlueGraphPolicy
{

  /** Write only PERSIST members. */
  persistOnly = false;

  /** Write only members a read takes back, for a round trip. */
  roundTrip = false;

  /** Run Initialize and OnModified; false reads without them, as a reader's initialize option does. */
  notify = true;

  /**
   * @param {{persistOnly?: boolean, roundTrip?: boolean, notify?: boolean}} [options={}] Choices.
   */
  constructor({ persistOnly = false, roundTrip = false, notify = true } = {})
  {
    this.persistOnly = persistOnly;
    this.roundTrip = roundTrip;
    this.notify = notify;
  }

  /**
   * Carbon's flags, through the same tests the values transport uses.
   * @cjs
   * @param {object} member Compiled graph member.
   * @param {object} info Graph class info.
   * @param {number} operation GraphOperation.
   * @returns {boolean} Whether the operation sees the member.
   */
  acceptMember(member, info, operation)
  {
    // A values bag carries no binary block (DictWriter.WriteBinaryBlock).
    if (member.field.type?.binary === true) return false;
    if (operation === GraphOperation.GET) return isExportableField(member.field, this);

    return isWritableField(member.field);
  }

  /**
   * Writes a changed list of an existing owner, with Carbon's list events.
   * A mapped list uses its own operations and observer, as IRootReader::ReadList does; an
   * ordinary array on an IListNotify owner sends the same events from the owner.
   * Modelled on: DictReader._ReadIList and _ReadLiveList.
   * @cjs UNLOADSTART runs with the old items still in the list.
   * @param {object} owner The list's owner.
   * @param {object} member Compiled graph member.
   * @param {Array} list The list.
   * @param {Array} items The new contents.
   * @returns {void}
   */
  replaceList(owner, member, list, items)
  {
    if (this.notify && mappedInterfaces(list.constructor).has(IList))
    {
      this._replaceMappedList(list, items);
      return;
    }

    const notify = this.notify ? CjsSchema.cast(owner, IListNotify) : null;

    if (notify !== null && list.length) notify.OnListModified(BLUELISTEVENT.BELIST_UNLOADSTART, 0, 0, null, list);

    list.length = 0;

    for (const item of items)
    {
      list.push(item);
      if (notify !== null && item !== null) notify.OnListModified(BLUELISTEVENT.BELIST_INSERTED, list.length, 0, item, list);
    }
  }

  /**
   * Refills a mapped list through Remove and Append, with its observer quiet for the fill.
   * @cjs As DictReader._ReadIList, which follows ReadList's clear then append.
   */
  _replaceMappedList(list, items)
  {
    const info = {};

    list.GetInfo(info);
    list.Remove(-1);
    list.SetNotify(null);

    for (const item of items)
    {
      if (item !== null) list.Append(item);
    }

    list.SetNotify(info.notify);
    if (info.notify) info.notify.OnListModified(BLUELISTEVENT.BELIST_LOADFINISHED, 0, 0, null, list);
  }

  /**
   * A created IInitialize object is initialised once. Otherwise each changed NOTIFY member
   * is told to INotify, in order.
   * Carbon: Copier::CopyToInternal (blueexposure/Copier.cpp:141, :209) for the created case.
   * @cjs On an existing object the door's rule holds: only members it changed are told.
   * @param {object} object The object.
   * @param {object} info Graph class info.
   * @param {object|false} changes What changed.
   * @param {boolean} created Whether this operation created it.
   * @returns {void}
   */
  complete(object, info, changes, created)
  {
    if (!this.notify) return;

    if (created)
    {
      const initialize = CjsSchema.cast(object, IInitialize);

      if (initialize)
      {
        initialize.Initialize();
        return;
      }
    }

    const notify = changes === false ? null : CjsSchema.cast(object, INotify);
    if (notify === null) return;

    const members = info.compiled.byName;
    for (const name of Object.keys(changes))
    {
      if (members[name][0].field.edit?.notify) notify.OnModified(name);
    }
  }

  /** Stable class identity. */
  static className = "CjsBlueGraphPolicy";

}
