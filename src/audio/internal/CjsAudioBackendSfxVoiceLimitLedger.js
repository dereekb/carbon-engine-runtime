import { CjsSchema } from "#schema";

// CarbonEngineJS original (no Carbon counterpart). Internal admission arbiter
// for CjsWebAudioSoundEngine's authored Wwise playback limits (SFX graph v3
// `voiceLimits`, `priority` and `virtualVoice`).

/** Fade, in ms, of a voice a playback limit kills or makes virtual. */
export const VOICE_LIMIT_KILL_FADE_MS = 50;

/** Priority of a Sound whose library entry carries none (Wwise's default). */
export const VOICE_LIMIT_DEFAULT_PRIORITY = 50;

const VOICE_LIMIT_SCOPES = new Set([ "game-object", "global" ]);
const VOICE_LIMIT_BEHAVIORS = new Set([ "reject-newest", "kill-oldest" ]);
const VOICE_LIMIT_ON_LIMIT = new Set([ "kill", "virtual" ]);

/** Owns SFX playback-limit reservations, their counters and the loser choice. */
export class CjsAudioBackendSfxVoiceLimitLedger
{
    _isOwnerActive = null;

    _priorityOf = null;

    _onReturn = null;

    _ownerReservations = new WeakMap();

    _reservations = new Map();

    /** Counter key -> { maxInstances, members: Map<reservationID, reservation> }. */
    _counters = new Map();

    /** Counter key -> Set of virtual reservations waiting to return there. */
    _waiting = new Map();

    _virtual = new Map();

    _nextReservationID = 1;

    _exemptGameObjID = 0;

    _returning = false;

    _counts = {
        admitted: 0,
        rejected: 0,
        killed: 0,
        virtualized: 0,
        returned: 0,
        virtualAsKill: 0,
    };

    /** Creates one arbiter against the backend's owner check and priority. */
    constructor({ isOwnerActive, priorityOf, onReturn } = {})
    {
        if (typeof isOwnerActive !== "function")
        {
            throw new TypeError(
                "SFX voice-limit ledger requires an active-owner predicate",
            );
        }
        this._isOwnerActive = isOwnerActive;
        this._priorityOf = typeof priorityOf === "function"
            ? priorityOf
            : reservation => Number(
                reservation.selection?.priority?.value
                    ?? VOICE_LIMIT_DEFAULT_PRIORITY,
            );
        this._onReturn = typeof onReturn === "function" ? onReturn : null;
    }

    /**
     * Exempts one game object from global counters (0 = none).
     *
     * Ours: a host policy for the listener's own object, which a global limit
     * must never silence. Its per-object counters still apply. Voices admitted
     * while exempt stay uncounted until they end.
     */
    SetExemptGameObject(gameObjID)
    {
        const value = Number(gameObjID);

        this._exemptGameObjID = Number.isFinite(value) ? value : 0;
    }

    /** Throws unless every authored limit of one selection is well formed. */
    static Validate(limits)
    {
        if (!Array.isArray(limits))
        {
            throw new TypeError("Resolved SFX voice limit is unsupported");
        }
        for (const limit of limits)
        {
            const max = Number(limit?.maxInstances);

            if (!limit
                || typeof limit !== "object"
                || typeof limit.counterId !== "string"
                || !limit.counterId
                || !VOICE_LIMIT_SCOPES.has(limit.scope)
                || !VOICE_LIMIT_BEHAVIORS.has(limit.behavior)
                || !VOICE_LIMIT_ON_LIMIT.has(limit.onLimit ?? "kill")
                || !Number.isSafeInteger(max)
                || max <= 0)
            {
                throw new TypeError("Resolved SFX voice limit is unsupported");
            }
        }
    }

    /**
     * Admits one selection against every counter it names, atomically.
     *
     * Each full counter picks its losers among its playing (bound) members and
     * the newcomer: the lowest effective priority, then on a tie the oldest
     * under kill-oldest and the newcomer under reject-newest. A loading member
     * is never picked. When any counter's loser is the newcomer nothing is
     * evicted. Returns `{ admitted, reservationID, virtual, evict }`, where
     * `evict` lists `{ reservation, outcome }` ("kill" or "virtual") for the
     * backend to apply, or `{ admitted: false, outcome }`.
     */
    Admit(owner, selection, priorityOf = this._priorityOf)
    {
        const counted = [];

        for (const limit of selection.voiceLimits ?? [])
        {
            const global = limit.scope === "global";

            if (global
                && this._exemptGameObjID !== 0
                && owner.gameObjID === this._exemptGameObjID)
            {
                continue;
            }
            counted.push({
                limit,
                key: global
                    ? `g:\0${limit.counterId}`
                    : `o:${String(owner.gameObjID)}\0${limit.counterId}`,
            });
        }

        const newcomer = { id: Infinity, owner, selection, voice: null };
        const priority = new Map();
        const rank = reservation =>
        {
            if (!priority.has(reservation))
            {
                const voice = reservation.voice;

                // A voice already fading out is the cheapest loser.
                priority.set(
                    reservation,
                    voice && (voice.stopping || voice.ended)
                        ? -Infinity
                        : Number(priorityOf(reservation)) || 0,
                );
            }
            return priority.get(reservation);
        };
        const evicted = new Map();
        let virtualNewcomer = false;

        for (const { limit, key } of counted)
        {
            const members = [ ...(this._counters.get(key)?.members.values() ?? []) ]
                .filter(member => !evicted.has(member));
            const need = members.length + 1 - Number(limit.maxInstances);

            if (need <= 0)
            {
                continue;
            }
            const newestFirst = limit.behavior === "reject-newest";
            const losers = members
                .filter(member => member.voice)
                .concat(newcomer)
                .sort((a, b) =>
                    rank(a) - rank(b)
                    || (newestFirst ? b.id - a.id : a.id - b.id))
                .slice(0, need);
            const onLimit = limit.onLimit ?? "kill";

            if (losers.length < need || losers.includes(newcomer))
            {
                const outcome = this._Outcome(onLimit, newcomer);

                if (outcome === "virtual")
                {
                    virtualNewcomer = true;
                }
                else if (outcome !== "continue")
                {
                    this._counts.rejected++;
                    return { admitted: false, outcome };
                }
                continue;
            }
            for (const loser of losers)
            {
                const outcome = this._Outcome(onLimit, loser);

                if (outcome !== "continue")
                {
                    evicted.set(loser, outcome);
                }
            }
        }

        const id = this._nextReservationID++;
        const reservation = {
            id,
            owner,
            selection,
            keys: counted.map(value => value.key),
            maxima: counted.map(value => Number(value.limit.maxInstances)),
            voice: null,
            virtual: false,
            virtualSeq: 0,
        };
        let ownerReservations = this._ownerReservations.get(owner);

        if (!ownerReservations)
        {
            ownerReservations = new Set();
            this._ownerReservations.set(owner, ownerReservations);
        }
        this._reservations.set(id, reservation);
        ownerReservations.add(id);
        this._counts.admitted++;

        if (virtualNewcomer)
        {
            evicted.clear();
            this._MakeVirtual(reservation);
            this._counts.virtualized++;
        }
        else
        {
            this._Count(reservation);
        }

        const evict = [];

        for (const [ loser, outcome ] of evicted)
        {
            if (outcome === "virtual")
            {
                this._Uncount(loser);
                this._MakeVirtual(loser);
                this._counts.virtualized++;
            }
            else
            {
                this._Remove(loser);
                this._counts.killed++;
            }
            evict.push({ reservation: loser, outcome });
        }
        return {
            admitted: true,
            reservationID: id,
            virtual: virtualNewcomer,
            evict,
        };
    }

    /** Returns the reservation behind one id, or null. */
    Get(reservationID)
    {
        return this._reservations.get(Number(reservationID)) ?? null;
    }

    /** Binds one pending reservation to its realized physical voice. */
    Bind(voice, reservationID)
    {
        if (reservationID === undefined)
        {
            return null;
        }
        const reservation = this._reservations.get(Number(reservationID));

        if (!reservation
            || reservation.voice
            || reservation.owner.gameObjID !== voice.gameObjID
            || !this._isOwnerActive(reservation.owner))
        {
            throw new Error("SFX voice-limit reservation is no longer active");
        }
        reservation.voice = voice;
        return reservation;
    }

    /** Counts one virtual voice the backend had to kill instead. */
    CountVirtualAsKill()
    {
        this._counts.virtualAsKill++;
    }

    /** Lets waiting virtual voices whose counters have room return. */
    ReturnWaiting()
    {
        this._ReturnVirtual([ ...this._waiting.keys() ]);
    }

    /** Releases one reservation owned by the expected playing record. */
    Release(owner, reservationID)
    {
        const id = Number(reservationID);
        const reservation = this._reservations.get(id);

        if (!reservation || reservation.owner !== owner)
        {
            return false;
        }
        const freed = reservation.virtual ? [] : reservation.keys;

        this._Remove(reservation);
        this._ReturnVirtual(freed);
        return true;
    }

    /** Releases every unbound reservation referenced by selected metadata. */
    ReleasePending(owner, selections)
    {
        for (const selection of selections ?? [])
        {
            const id = selection.voiceLimitReservationId;
            const reservation = this._reservations.get(Number(id));

            if (id !== undefined
                && reservation?.owner === owner
                && !reservation.voice)
            {
                this.Release(owner, id);
            }
        }
    }

    /** Releases every reservation still owned by one playing record. */
    ReleaseAll(owner)
    {
        for (const id of [ ...(this._ownerReservations.get(owner) ?? []) ])
        {
            this.Release(owner, id);
        }
    }

    /** Counts the virtual reservations. */
    VirtualCount()
    {
        return this._virtual.size;
    }

    /** Lists the virtual reservations, oldest first. */
    VirtualReservations()
    {
        return [ ...this._virtual.values() ];
    }

    /**
     * Reports the counters and what the limits did since start.
     *
     * Ours: `counters` counts the occupied counters, `full` those at their
     * maximum, `members` the counted voices and `virtual` the parked ones;
     * the rest are counts since start.
     */
    Report()
    {
        let full = 0;
        let members = 0;

        for (const counter of this._counters.values())
        {
            members += counter.members.size;
            if (counter.members.size >= counter.maxInstances)
            {
                full++;
            }
        }
        return {
            exempt: this._exemptGameObjID,
            counters: this._counters.size,
            full,
            members,
            virtual: this._virtual.size,
            ...this._counts,
        };
    }

    /** Resolves a loser's outcome from the counter's setting and its own. */
    _Outcome(onLimit, reservation)
    {
        if (onLimit !== "virtual")
        {
            return "kill";
        }
        const belowThreshold = reservation.selection?.virtualVoice
            ?.belowThreshold ?? "continue";

        if (belowThreshold === "continue" || belowThreshold === "virtual")
        {
            return belowThreshold;
        }
        if (belowThreshold === "kill-if-finite-else-virtual")
        {
            const loops = reservation.voice?.loop
                ?? reservation.selection?.loop;

            return loops ? "virtual" : "kill";
        }
        return "kill";
    }

    /** Adds one reservation to every counter it names. */
    _Count(reservation)
    {
        reservation.keys.forEach((key, index) =>
        {
            let counter = this._counters.get(key);

            if (!counter)
            {
                counter = { maxInstances: 0, members: new Map() };
                this._counters.set(key, counter);
            }
            counter.maxInstances = reservation.maxima[index];
            counter.members.set(reservation.id, reservation);
        });
    }

    /** Takes one reservation out of its counters, dropping emptied ones. */
    _Uncount(reservation)
    {
        for (const key of reservation.keys)
        {
            const counter = this._counters.get(key);

            counter?.members.delete(reservation.id);
            if (counter?.members.size === 0)
            {
                this._counters.delete(key);
            }
        }
    }

    /** Parks one reservation in the virtual queue of every counter it names. */
    _MakeVirtual(reservation)
    {
        reservation.virtual = true;
        reservation.virtualSeq = this._nextReservationID++;
        this._virtual.set(reservation.id, reservation);
        for (const key of reservation.keys)
        {
            let waiting = this._waiting.get(key);

            if (!waiting)
            {
                waiting = new Set();
                this._waiting.set(key, waiting);
            }
            waiting.add(reservation);
        }
    }

    /** Drops one reservation from the arbiter entirely. */
    _Remove(reservation)
    {
        if (reservation.virtual)
        {
            this._Unwait(reservation);
        }
        else
        {
            this._Uncount(reservation);
        }
        this._reservations.delete(reservation.id);
        const ownerReservations = this._ownerReservations.get(
            reservation.owner,
        );

        ownerReservations?.delete(reservation.id);
        if (ownerReservations?.size === 0)
        {
            this._ownerReservations.delete(reservation.owner);
        }
    }

    /** Takes one reservation out of the virtual queues. */
    _Unwait(reservation)
    {
        reservation.virtual = false;
        this._virtual.delete(reservation.id);
        for (const key of reservation.keys)
        {
            const waiting = this._waiting.get(key);

            waiting?.delete(reservation);
            if (waiting?.size === 0)
            {
                this._waiting.delete(key);
            }
        }
    }

    /**
     * Returns waiting virtual voices whose every counter has room: the highest
     * priority first, ties to the earliest virtualized. Only bound ones return.
     */
    _ReturnVirtual(keys)
    {
        if (this._returning || this._virtual.size === 0)
        {
            return;
        }
        const candidates = new Set();

        for (const key of keys)
        {
            for (const reservation of this._waiting.get(key) ?? [])
            {
                if (reservation.voice)
                {
                    candidates.add(reservation);
                }
            }
        }
        if (!candidates.size)
        {
            return;
        }
        const priority = new Map([ ...candidates ].map(reservation => [
            reservation,
            Number(this._priorityOf(reservation)) || 0,
        ]));
        const ordered = [ ...candidates ].sort((a, b) =>
            priority.get(b) - priority.get(a) || a.virtualSeq - b.virtualSeq);

        this._returning = true;
        try
        {
            for (const reservation of ordered)
            {
                const room = reservation.keys.every((key, index) =>
                    (this._counters.get(key)?.members.size ?? 0)
                        < reservation.maxima[index]);

                if (!room
                    || !reservation.virtual
                    || !this._reservations.has(reservation.id))
                {
                    continue;
                }
                this._Unwait(reservation);
                this._Count(reservation);
                this._counts.returned++;
                this._onReturn?.(reservation);
            }
        }
        finally
        {
            this._returning = false;
        }
    }
}

CjsSchema.meta.define("CjsAudioBackendSfxVoiceLimitLedger")(CjsAudioBackendSfxVoiceLimitLedger);
