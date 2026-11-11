import assert from "node:assert/strict";
import test from "node:test";
import { Tr2MainWindow } from "../../../npm/dist/input/index.js";

test("MainWindow public destruction removes listeners even when Close is vetoed", () =>
{
    const host = new EventTarget();
    let seen = 0, peerSeen = 0, closeCalls = 0;
    const owner = new Tr2MainWindow({ window: host, target: host, onFocusChange: () => seen++, onClose: () => { closeCalls++; return false; } });
    const peer = new Tr2MainWindow({ window: host, target: host, onFocusChange: () => peerSeen++ });
    try
    {
        host.dispatchEvent(new Event("focus"));
        assert.equal(seen, 1);
        assert.equal(owner.Close(), false);
        owner.Destruct();
        owner.Destruct();
        host.dispatchEvent(new Event("focus"));
        assert.equal(seen, 1);
        assert.equal(peerSeen, 2);
        assert.equal(closeCalls, 1, "teardown does not ask Close for permission");
    }
    finally { peer.Destruct(); }
});
