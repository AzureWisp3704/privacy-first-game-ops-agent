import assert from "node:assert/strict";
import test from "node:test";
import { createGameState, registerAsset, scheduleEvent } from "../src/game_backend.js";

test("sensitive player data enters moderation and cannot be published in an event", () => {
  const state = createGameState();
  const review = registerAsset(state, "op-asset-7", {
    assetId: "asset-7",
    ownerId: "player-42",
    title: "Recovery journal skin",
    riskTags: ["health-data"],
  });
  const scheduling = scheduleEvent(state, "op-event-7", {
    eventId: "event-7",
    assetId: "asset-7",
    startsAt: "2026-09-01T18:00:00.000Z",
  });

  assert.deepEqual(review, { decision: "queued", assetId: "asset-7" });
  assert.deepEqual(scheduling, {
    scheduled: false,
    eventId: "event-7",
    reason: "asset awaits moderation",
  });
  assert.equal(state.moderationQueue.get("asset-7")?.status, "pending");
  assert.equal(state.events.size, 0);
});

test("an operation id makes an asset write repeatable", () => {
  const state = createGameState();
  const first = registerAsset(state, "op-1", {
    assetId: "asset-1",
    ownerId: "player-1",
    title: "Blue banner",
    riskTags: [],
  });
  const repeated = registerAsset(state, "op-1", {
    assetId: "asset-other",
    ownerId: "player-1",
    title: "Different banner",
    riskTags: [],
  });

  assert.deepEqual(repeated, first);
  assert.equal(state.assets.has("asset-other"), false);
});
