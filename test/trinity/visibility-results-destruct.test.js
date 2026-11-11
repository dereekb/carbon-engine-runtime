import assert from "node:assert/strict";
import test from "node:test";
import { Tr2VisibilityResults, Tr2VisibilityEvent, Tr2Sprite2dContainer } from "../../npm/dist/trinity/index.js";

test("visibility result destruction clears its events without destroying shared event data", t =>
{
  const results = new Tr2VisibilityResults(), peer = new Tr2VisibilityResults();
  const event = new Tr2VisibilityEvent();
  event.userData = new Tr2Sprite2dContainer();
  const destroyUserData = t.mock.method(event.userData, "Destruct", () => assert.fail("shared user data must not be destroyed"));
  results.AddVisibilityEvent(event);
  peer.AddVisibilityEvent(event);
  const retained = results.GetEvents();
  assert.equal(results.GetNumVisibilityEvents(), 1);
  for (let repeat = 0; repeat < 2; repeat++)
  {
    results.Destruct();
    assert.equal(results.GetNumVisibilityEvents(), 0);
    assert.deepEqual(results.GetEvents(), []);
    assert.deepEqual(peer.GetEvents(), [event]);
    assert.deepEqual(retained, [event]);
    assert.equal(destroyUserData.mock.callCount(), 0);
  }
  peer.Destruct();
  assert.equal(peer.GetNumVisibilityEvents(), 0);
  assert.equal(destroyUserData.mock.callCount(), 0);
});
