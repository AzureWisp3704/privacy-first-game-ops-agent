export type PlayerAsset = {
  assetId: string;
  ownerId: string;
  title: string;
  riskTags: string[];
};

export type LiveEvent = {
  eventId: string;
  assetId: string;
  startsAt: string;
};

export type ModerationItem = {
  assetId: string;
  reason: string;
  status: "pending";
};

export type GameState = {
  assets: Map<string, PlayerAsset>;
  events: Map<string, LiveEvent>;
  moderationQueue: Map<string, ModerationItem>;
  completedOperations: Map<string, unknown>;
};

export function createGameState(): GameState {
  return {
    assets: new Map(),
    events: new Map(),
    moderationQueue: new Map(),
    completedOperations: new Map(),
  };
}

const sensitiveTags = new Set(["health-data", "real-name", "contact-info"]);

export function registerAsset(
  state: GameState,
  operationId: string,
  asset: PlayerAsset,
): { decision: "approved" | "queued"; assetId: string } {
  const prior = state.completedOperations.get(operationId);
  if (prior) return prior as { decision: "approved" | "queued"; assetId: string };

  state.assets.set(asset.assetId, asset);
  const flaggedTag = asset.riskTags.find((tag) => sensitiveTags.has(tag));
  const result = { decision: flaggedTag ? "queued" as const : "approved" as const, assetId: asset.assetId };

  if (flaggedTag) {
    state.moderationQueue.set(asset.assetId, {
      assetId: asset.assetId,
      reason: `sensitive tag: ${flaggedTag}`,
      status: "pending",
    });
  }
  state.completedOperations.set(operationId, result);
  return result;
}

export function scheduleEvent(
  state: GameState,
  operationId: string,
  event: LiveEvent,
): { scheduled: boolean; eventId: string; reason?: string } {
  const prior = state.completedOperations.get(operationId);
  if (prior) return prior as { scheduled: boolean; eventId: string; reason?: string };

  const asset = state.assets.get(event.assetId);
  let result: { scheduled: boolean; eventId: string; reason?: string };
  if (!asset) {
    result = { scheduled: false, eventId: event.eventId, reason: "asset is not registered" };
  } else if (state.moderationQueue.has(event.assetId)) {
    result = { scheduled: false, eventId: event.eventId, reason: "asset awaits moderation" };
  } else {
    state.events.set(event.eventId, event);
    result = { scheduled: true, eventId: event.eventId };
  }
  state.completedOperations.set(operationId, result);
  return result;
}
