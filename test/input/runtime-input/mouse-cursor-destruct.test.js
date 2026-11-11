import test from "node:test";
import assert from "node:assert/strict";
import { resolveObjectURL } from "node:buffer";
import { Tr2MouseCursor } from "../../../npm/dist/input/index.js";

// Carbon UI/Tr2MouseCursor.cpp:26-34 releases the owned platform cursor;
// the browser adaptation owns only URLs it creates, never supplied URLs.
test("cursor teardown revokes owned URLs once and preserves borrowed URLs and peers", t =>
{
    const created = [];
    const revoked = [];
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    t.mock.method(URL, "createObjectURL", blob =>
    {
        const url = create(blob);
        created.push(url);
        return url;
    });
    t.mock.method(URL, "revokeObjectURL", url =>
    {
        revoked.push(url);
        revoke(url);
    });
    const blob = new Blob(["cursor"]);
    const external = create(blob);
    const owner = new Tr2MouseCursor(blob);
    const peer = new Tr2MouseCursor(blob);
    const borrowed = new Tr2MouseCursor(external);
    t.after(() =>
    {
        for (const url of created) revoke(url);
        revoke(external);
    });
    assert.equal(created.length, 2);
    assert.ok(resolveObjectURL(created[0]));
    owner.Destruct();
    owner.Destruct();
    borrowed.Destruct();
    assert.deepEqual(revoked, [created[0]]);
    assert.equal(resolveObjectURL(created[0]), undefined);
    assert.equal(owner.IsValid(), false);
    assert.ok(resolveObjectURL(created[1]));
    assert.ok(resolveObjectURL(external));
    assert.equal(peer.IsValid(), true);
    assert.equal(peer.Apply({ style: {} }), true);
    peer.Destruct();
    assert.deepEqual(revoked, created);
    assert.equal(resolveObjectURL(created[1]), undefined);
});
