// Source: blueexposure/include/BlueListUtil.h:172-347,459-476,506-781
import { CjsSchema } from "#schema";
import { BLUELISTEVENT } from "#consts/blue";
import * as CcpLog from "../../global/logging/ccpLog.js";
import { BlueClasses } from "./BlueClasses.js";
import { BeClasses } from "./classes/registry.js";
import { IList } from "./IList.js";
import { IListNotify } from "./IListNotify.js";
import { ICopierCustomAssignment } from "./ICopierCustomAssignment.js";

/**
 * HERE BE DRAGONS: `list[i] = item` and `list.length = n` cannot be caught. JavaScript
 * gives an Array subclass no hook for either, and a Proxy costs too much. They skip
 * admission and notification, so the owner is never told. Change a list through its
 * methods. Every Array method that mutates either notifies or, for `fill` and
 * `copyWithin`, throws. `Sort` is Carbon's, and stays silent.
 *
 * A typed object list with Carbon's explicit single-observer mutation methods.
 * Adapted: constructor configuration replaces C++ template parameters; Array
 * storage replaces the native vector and pointer/reference-count machinery.
 * `push`, `pop`, `shift`, `unshift` and `splice` notify as Carbon's Append, Insert and
 * Remove do, but do not check the item type: a wrong item stays in the list rather than
 * vanishing. `sort` and `reverse` reorder through Swap. Only Append and Insert refuse an
 * item, and they log it. Carbon reaches its vector with neither check nor event
 * (BlueListUtil.h:206-210); code that needs that asks for it deliberately, with
 * `Array.prototype.push.call(list, item)`, and keeps the non-null, correctly typed item
 * invariant itself. This template is not registered as a concrete native List or an
 * automatically constructible specialization. Callers must supply the element type and
 * copy destination.
 */
export class BlueList extends Array
{
  /** Element-interface constructor items must expose. Set by the constructor. */
  _itemType = null;

  /** Optional native element CLSID, or null. Set by the constructor. */
  _className = null;

  /** ListInfo listOps flag word; metadata only. Set by the constructor. */
  _listOps = 0;

  /** The single IListNotify observer, or null (SetNotify). */
  _notify = null;

  /**
   * Creates an empty list with an exact element-interface identity.
   * Adapted: className explicitly supplies the optional native element CLSID;
   * it is not inferred from interface registration. listOps is metadata only.
   * @param {Function} ItemType Constructor identity required by QueryInterface.
   * @param {{className?: string|null, listOps?: number}} [options={}] Template facts.
   */
  constructor(ItemType, { className = null, listOps = 0 } = {})
  {
    super();
    if (typeof ItemType !== "function" || !ItemType.prototype)
      throw new TypeError("BlueList requires an element-interface constructor.");
    if (className !== null && (typeof className !== "string" || !className.trim()))
      throw new TypeError("BlueList className must be a non-empty string or null.");
    if (!Number.isInteger(listOps) || listOps < -0x80000000 || listOps > 0xffffffff)
      throw new TypeError("BlueList listOps must be a 32-bit flag word.");
    this._itemType = ItemType;
    this._className = className;
    this._listOps = listOps;
  }

  /**
   * @implemented
   * @returns {number} The number of stored items.
   */
  GetSize()
  {
    return this.length;
  }

  /**
   * Writes the native ListInfo facts without replacing the output record.
   *
   * @adapted iid is a constructor identity and clsid is the explicit optional
   *   class name; JavaScript record names omit the native m prefix.
   * @param {object} info Caller-owned output record.
   * @returns {void}
   */
  GetInfo(info)
  {
    info.iid = this._itemType;
    info.clsid = this._className;
    info.listOps = this._listOps;
    info.notify = this._notify;
  }

  /**
   * Replaces all the contents as ReadList does: Remove(-1), a quiet fill, then LOADFINISHED.
   * Modelled on: DictReader::ReadList (blue/src/DictReader.cpp:427-476).
   *
   * @cjs The graph's list write. Null items are skipped, as ReadList skips them.
   * @param {Array} items The new contents.
   * @returns {void}
   */
  ReplaceItems(items)
  {
    const info = {};

    this.Remove(-1);
    this.GetInfo(info);
    this.SetNotify(null);

    for (const item of items)
    {
      if (item !== null) this.Append(item);
    }

    this.SetNotify(info.notify);
    if (info.notify) info.notify.OnListModified(BLUELISTEVENT.BELIST_LOADFINISHED, 0, 0, null, this);
  }

  /**
   * Inserts a typed item, then notifies with its actual index.
   *
   * @adapted exact mapped identities replace native QI pointer conversion.
   *   Non-integer keys are rejected rather than coerced into native ssize_t.
   *   A refused item is logged; Carbon's refusal is silent to a native caller.
   * @param {number} key Insertion index, or -1 for the old list length.
   * @param {object} value Non-null item exposing the element interface.
   * @returns {boolean} False leaves the list unchanged.
   */
  Insert(key, value)
  {
    if (!BlueList._Admit(this, value)) return false;
    if (!BlueList._RangeCheck(key, this.length, true)) return false;
    BlueList._InsertAt(this, key === -1 ? this.length : key, value);
    return true;
  }

  /**
   * Appends a typed item, then reports the post-insert size as the event key.
   * This native quirk differs from Insert(-1) (BlueListUtil.h:610-615).
   *
   * @adapted mapped constructor identities replace native QI pointer conversion.
   *   A refused item is logged; Carbon's refusal is silent to a native caller.
   * @param {object} value Non-null item exposing the element interface.
   * @returns {boolean} False leaves the list unchanged.
   */
  Append(value)
  {
    if (!BlueList._Admit(this, value)) return false;
    Array.prototype.push.call(this, value);
    if (this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_INSERTED, this.length, 0, value, this);
    return true;
  }

  /**
   * Removes an item after selecting it, or sends UNLOADSTART before clearing.
   * Empty clears and null entries do not notify; clear emits no REMOVED events.
   * Keys failing RangeCheck return false without mutation (BlueListUtil.h:643-646).
   *
   * @adapted JavaScript references replace native Unlock calls.
   * @param {number} key Item index or -1 to clear.
   * @returns {boolean} Whether the index was valid.
   */
  Remove(key)
  {
    if (key === -1)
    {
      if (!this.length) return true;
      if (this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_UNLOADSTART, 0, 0, null, this);
      this.length = 0;
      return true;
    }
    if (!BlueList._RangeCheck(key, this.length, false)) return false;
    const value = this[key];
    for (let i = key + 1; i < this.length; i++) this[i - 1] = this[i];
    this.length--;
    if (value && this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_REMOVED, key, 0, value, this);
    return true;
  }

  /**
   * Reads an item, or null when the key fails RangeCheck (BlueListUtil.h:670-678).
   * RangeCheck admits -1, which then reaches vector::at and throws; here that
   * is the RangeError from At. Raw JS holes represent null storage.
   *
   * @adapted
   * @param {number} key Item index.
   * @returns {object|null} Item or null.
   * @throws {RangeError} For -1, as vector::at throws std::out_of_range.
   */
  GetAt(key)
  {
    if (!BlueList._RangeCheck(key, this.length, false)) return null;
    return BlueList._At(this, key) ?? null;
  }

  /**
   * Finds the first matching exposed object identity at or after keyFrom.
   * Follows Carbon's order (BlueListUtil.h:681-711): a null value, then
   * RangeCheck on a nonzero keyFrom, then the interface query, each returning -1.
   * RangeCheck admits -1, and Carbon then iterates from begin() - 1 unchecked;
   * that start throws a RangeError here (ruling 11).
   *
   * @adapted mapped identities replace QI.
   * @param {object} value Item to find.
   * @param {number} [keyFrom=0] First index to search.
   * @returns {number} Index or -1.
   * @throws {RangeError} For keyFrom -1 with an admitted value.
   */
  FindKey(value, keyFrom = 0)
  {
    if (value === null || value === undefined) return -1;
    if (keyFrom !== 0 && !BlueList._RangeCheck(keyFrom, this.length, false)) return -1;
    if (!BlueList._AcceptsItem(this, value)) return -1;

    if (keyFrom < 0) throw new RangeError(`BlueList.FindKey: keyFrom ${keyFrom} is before the first item.`);
    return Array.prototype.indexOf.call(this, value, keyFrom);
  }

  /**
   * Swaps items and sends SWAPPED, including when both indexes are equal.
   * Keys failing RangeCheck return false (BlueListUtil.h:714-735). RangeCheck
   * admits -1, which then reaches vector::at and throws before any write.
   *
   * @adapted
   * @param {number} key1 First index.
   * @param {number} key2 Second index.
   * @returns {boolean} Whether both indexes passed RangeCheck.
   * @throws {RangeError} For -1, as vector::at throws std::out_of_range.
   */
  Swap(key1, key2)
  {
    if (!BlueList._RangeCheck(key1, this.length, false)) return false;
    if (!BlueList._RangeCheck(key2, this.length, false)) return false;

    const value = BlueList._At(this, key1);
    this[key1] = BlueList._At(this, key2);
    this[key2] = value;
    if (this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_SWAPPED, key1, key2, null, this);
    return true;
  }

  /**
   * Moves an item by shifting the items between, then sends MOVED, including
   * when from equals to. Keys failing RangeCheck return false
   * (BlueListUtil.h:739-768). RangeCheck admits -1, which then reaches
   * vector::at and throws: before any write for from, and after the items
   * above it have shifted for to, exactly as Carbon's loop does.
   *
   * @adapted
   * @param {number} from Original index.
   * @param {number} to Destination index.
   * @returns {boolean} Whether both indexes passed RangeCheck.
   * @throws {RangeError} For -1, as vector::at throws std::out_of_range.
   */
  Move(from, to)
  {
    if (!BlueList._RangeCheck(from, this.length, false)) return false;
    if (!BlueList._RangeCheck(to, this.length, false)) return false;

    let i = from;
    const value = BlueList._At(this, from);
    for (; i < to; i++) this[i] = BlueList._At(this, i + 1);
    for (; i > to; i--) this[i] = BlueList._At(this, i - 1);
    this[to] = value;
    if (this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_MOVED, from, to, null, this);
    return true;
  }

  /**
   * Sorts without notification, passing the opaque context to every comparison.
   *
   * @adapted Carbon's boolean less-than predicate becomes Array.sort's numeric
   *   comparator; equivalent elements use JavaScript's stable ordering.
   * @param {Function} compare Called as (context, a, b), returning whether a < b.
   * @param {*} context Caller-owned comparison context.
   * @returns {void}
   */
  Sort(compare, context)
  {
    Array.prototype.sort.call(this, (a, b) => compare(context, a, b) ? -1 : compare(context, b, a) ? 1 : 0);
  }

  /**
   * Replaces the list's one observer without sending an event.
   *
   * @adapted C++ accepts an IListNotify pointer; JS checks nominal composition,
   *   independently of the observer's exposed QueryInterface table.
   * @param {IListNotify|null} notify Observer or null.
   * @returns {void}
   */
  SetNotify(notify)
  {
    if (notify !== null && !CjsSchema.cast(notify, IListNotify))
      throw new TypeError("BlueList.SetNotify requires IListNotify or null.");
    this._notify = notify;
  }

  /**
   * Returns borrowed storage and a snapshot of its size.
   *
   * @adapted the native pointer/size pair is a named JavaScript record; items is
   *   this same array, so an index write through it does not emit a list notification.
   * @returns {{items: BlueList, size: number}} Borrowed storage and captured size.
   */
  GetAllItems()
  {
    return { items: this, size: this.length };
  }

  /**
   * @implemented
   * @returns {boolean} Whether clearing succeeded.
   */
  Clear()
  {
    return this.Remove(-1);
  }

  /**
   * Removes first, then inserts the replacement, as native Replace does.
   * Native quirk: an invalid replacement can therefore leave the old item
   * removed (BlueListUtil.h:273-278); it is not an atomic operation.
   *
   * @implemented
   * @param {number} key Item index.
   * @param {object} value Replacement item.
   * @returns {boolean} Whether removal and insertion both succeeded.
   */
  Replace(key, value)
  {
    if (!this.Remove(key)) return false;
    return this.Insert(key, value);
  }

  /**
   * Clears then shares the items from a list of the same configured type.
   *
   * @adapted JS references replace native Lock calls; generic-template equality
   *   is checked explicitly. No per-item insertion or LOADFINISHED event is sent.
   * @param {BlueList} other Source list with identical template facts.
   * @returns {void}
   */
  AssignFrom(other)
  {
    if (!BlueList._SameListType(this, other)) throw new TypeError("BlueList.AssignFrom requires the same configured list type.");
    this.Remove(-1);
    for (let i = 0; i < other.length; i++) Array.prototype.push.call(this, other[i]);
  }

  /**
   * Copies items into an existing list, retaining its observer.
   * Clear notifies before pre-sizing; each copied item must expose ItemType.
   * A null copy result or rejected copied type leaves the copied prefix without
   * LOADFINISHED. Nonempty success
   * sends exactly one LOADFINISHED on the destination; empty success sends none.
   *
   * @adapted CopyTo returns the copied object or null rather than bool plus an
   *   IRoot out-pointer. Constructor/configuration equality replaces a C++ template
   *   cast. An outer Copier.CopyTo call owns memoization and recursive topology.
   *   Raw nulls or holes violate the typed-list invariant and can throw through
   *   Copier; exceptions propagate without LOADFINISHED or a rollback guarantee.
   * @param {BlueList} other Existing destination with identical template facts.
   * @param {ICopier} copier Copier running the outer operation.
   * @returns {boolean} Whether all items copied and exposed the required type.
   */
  AssignTo(other, copier)
  {
    if (!BlueList._SameListType(this, other)) return false;
    if (!other.Remove(-1)) return false;
    other.length = this.length;
    Array.prototype.fill.call(other, null);
    let i = 0;
    for (; i < this.length; i++)
    {
      const copy = copier.CopyTo(this[i], null);
      if (!BlueList._AcceptsItem(this, copy))
      {
        other.length = i;
        return false;
      }
      other[i] = copy;
    }
    if (i && other._notify) other._notify.OnListModified(BLUELISTEVENT.BELIST_LOADFINISHED, 0, 0, null, other);
    return true;
  }

  /**
   * Array's push: notifies with Append's key, without its type check.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @param {...object} items Items to append.
   * @returns {number} The new length.
   */
  push(...items)
  {
    for (let i = 0; i < items.length; i++)
    {
      Array.prototype.push.call(this, items[i]);
      if (items[i] && this._notify) this._notify.OnListModified(BLUELISTEVENT.BELIST_INSERTED, this.length, 0, items[i], this);
    }
    return this.length;
  }

  /**
   * Array's pop, through Remove.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @returns {object|undefined} The removed item, or undefined for an empty list.
   */
  pop()
  {
    if (!this.length) return undefined;
    const value = this[this.length - 1];
    this.Remove(this.length - 1);
    return value;
  }

  /**
   * Array's shift, through Remove.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @returns {object|undefined} The removed item, or undefined for an empty list.
   */
  shift()
  {
    if (!this.length) return undefined;
    const value = this[0];
    this.Remove(0);
    return value;
  }

  /**
   * Array's unshift: notifies as Insert does, without its type check.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @param {...object} items Items to insert at the front.
   * @returns {number} The new length.
   */
  unshift(...items)
  {
    for (let i = 0; i < items.length; i++) BlueList._InsertAt(this, i, items[i]);
    return this.length;
  }

  /**
   * Array's splice: removes through Remove, then inserts as Insert does without its type
   * check, one event per item. Written out because native splice on an Array subclass is
   * 27-50 times slower than on an Array, measured at 4 to 1024 items.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @param {number} [start] First index; negative counts from the end.
   * @param {number} [deleteCount] Items to remove; omitted means to the end.
   * @param {...object} items Items to insert at start.
   * @returns {object[]} The removed items, in a plain array.
   */
  splice(start, deleteCount, ...items)
  {
    const size = this.length;
    const relative = Math.trunc(start) || 0;
    const index = relative < 0 ? Math.max(size + relative, 0) : Math.min(relative, size);

    let count = 0;
    if (arguments.length === 1) count = size - index;
    else if (arguments.length > 1) count = Math.min(Math.max(Math.trunc(deleteCount) || 0, 0), size - index);

    const removed = new Array(count);
    for (let i = 0; i < count; i++)
    {
      removed[i] = this[index];
      this.Remove(index);
    }

    for (let i = 0; i < items.length; i++) BlueList._InsertAt(this, index + i, items[i]);
    return removed;
  }

  /**
   * Array's sort, reaching the order through Swap so an observer hears each step.
   * With no observer, or nothing out of place, it sends nothing.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @param {Function} [compare] Array's numeric comparator.
   * @returns {BlueList} This list.
   */
  sort(compare)
  {
    if (!this._notify) return Array.prototype.sort.call(this, compare);

    const sorted = Array.prototype.slice.call(this).sort(compare);
    for (let i = 0; i < sorted.length; i++)
    {
      if (this[i] !== sorted[i]) this.Swap(i, Array.prototype.indexOf.call(this, sorted[i], i + 1));
    }
    return this;
  }

  /**
   * Array's reverse, through Swap.
   *
   * @cjs JavaScript callers change a list through Array's names.
   * @returns {BlueList} This list.
   */
  reverse()
  {
    if (!this._notify) return Array.prototype.reverse.call(this);

    for (let i = 0, j = this.length - 1; i < j; i++, j--) this.Swap(i, j);
    return this;
  }

  /**
   * @cjs An object list has no use for it, and it would fire no event.
   * @throws {TypeError} Always.
   */
  fill()
  {
    throw new TypeError("BlueList does not support fill.");
  }

  /**
   * @cjs An object list has no use for it, and it would fire no event.
   * @throws {TypeError} Always.
   */
  copyWithin()
  {
    throw new TypeError("BlueList does not support copyWithin.");
  }

  /** Opens a slot, stores the value and sends INSERTED. Native splice on an Array subclass is far slower. */
  static _InsertAt(list, index, value)
  {
    for (let i = list.length; i > index; i--) list[i] = list[i - 1];
    list[index] = value;
    if (value && list._notify) list._notify.OnListModified(BLUELISTEVENT.BELIST_INSERTED, index, 0, value, list);
  }

  /** Admission for Append and Insert: a refused item is logged, so a drop is never silent. */
  static _Admit(list, value)
  {
    if (BlueList._AcceptsItem(list, value)) return true;

    CcpLog.CCP_LOGERR_CH(CcpLog.GetModuleChannel("blue"), "BlueList of %s refused %s",
      CjsSchema.getClassName(list._itemType) ?? list._itemType.name, CjsSchema.getClassName(value?.constructor) ?? String(value));
    return false;
  }

  /** Native QI admission, represented by the exact constructor identity in the exposure table. */
  static _AcceptsItem(list, value)
  {
    return value !== null && typeof value === "object" && BeClasses.QueryThisInterface(value, list._itemType, value.constructor, BlueClasses.BLUEQIOPT.BEQI_SILENT) !== null;
  }

  /**
   * Ports BlueListBase::RangeCheck (BlueListUtil.h:90-125): -1 is admitted, and
   * insert also admits one past the end. Failure returns false; Carbon also sets a
   * Python IndexError, which has no JS counterpart.
   * Adapted: Carbon's key is ssize_t; a JS Number can be non-integer, so a
   * non-integer key fails the check rather than being coerced.
   * @param {number} key Item key.
   * @param {number} size List size.
   * @param {boolean} insert Whether one past the end is admitted.
   * @returns {boolean} Whether the key is admitted.
   */
  static _RangeCheck(key, size, insert)
  {
    if (!Number.isInteger(key)) return false;
    return insert ? key >= -1 && key <= size : key >= -1 && key < size;
  }

  /**
   * Ports vector::at: an index outside the stored items throws, as
   * std::out_of_range does, instead of reading undefined.
   * @param {BlueList} list List storage.
   * @param {number} index Item index.
   * @returns {object|null|undefined} Stored item; a raw hole reads as undefined.
   * @throws {RangeError} When index is outside [0, length).
   */
  static _At(list, index)
  {
    if (index < 0 || index >= list.length) throw new RangeError(`BlueList: index ${index} out of range, size is ${list.length}.`);
    return list[index];
  }

  /** C++ fixes these facts in the list's template type; JavaScript stores them on each list. */
  static _SameListType(source, dest)
  {
    return Array.isArray(dest) && dest.constructor === source.constructor
      && dest._itemType === source._itemType && dest._className === source._className
      && dest._listOps === source._listOps;
  }
}

// Array methods create ordinary arrays, never pass a result length as ItemType.
Object.defineProperty(BlueList, Symbol.species, { value: Array });
CjsSchema.be.inherit(IList, ICopierCustomAssignment)(BlueList, { kind: "class" });
CjsSchema.exposure.mapInterface(IList)(BlueList);
CjsSchema.exposure.mapInterface(ICopierCustomAssignment)(BlueList);
for (const name of [ "GetSize", "Clear", "Replace" ]) CjsSchema.decorateMethod(BlueList, name, CjsSchema.be.method);
for (const name of [ "GetInfo", "Insert", "Append", "Remove", "GetAt", "FindKey", "Swap", "Move", "Sort", "SetNotify", "GetAllItems", "AssignFrom", "AssignTo" ])
{
  CjsSchema.decorateMethod(BlueList, name, CjsSchema.be.method);
}
