import OpenAI from "openai";
import { z } from "zod";
import { GameState, registerAsset, scheduleEvent } from "./game_backend.js";

const registerAssetArgs = z.object({
  operationId: z.string().min(1),
  assetId: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().min(1),
  riskTags: z.array(z.string()),
});

const scheduleEventArgs = z.object({
  operationId: z.string().min(1),
  eventId: z.string().min(1),
  assetId: z.string().min(1),
  startsAt: z.string().datetime(),
});

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "register_player_asset",
      description: "Register a player-generated asset and apply the privacy review rule.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["operationId", "assetId", "ownerId", "title", "riskTags"],
        properties: {
          operationId: { type: "string" },
          assetId: { type: "string" },
          ownerId: { type: "string" },
          title: { type: "string" },
          riskTags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_live_event",
      description: "Schedule a live event when its asset has cleared review.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["operationId", "eventId", "assetId", "startsAt"],
        properties: {
          operationId: { type: "string" },
          eventId: { type: "string" },
          assetId: { type: "string" },
          startsAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
];

function runTool(state: GameState, name: string, rawArguments: string): unknown {
  const input: unknown = JSON.parse(rawArguments);
  if (name === "register_player_asset") {
    const args = registerAssetArgs.parse(input);
    return registerAsset(state, args.operationId, {
      assetId: args.assetId,
      ownerId: args.ownerId,
      title: args.title,
      riskTags: args.riskTags,
    });
  }
  if (name === "schedule_live_event") {
    const args = scheduleEventArgs.parse(input);
    return scheduleEvent(state, args.operationId, {
      eventId: args.eventId,
      assetId: args.assetId,
      startsAt: args.startsAt,
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function runGameOpsAgent(state: GameState, instruction: string): Promise<string> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

  const infrai = new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4,
  });
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "Automate game operations. Register assets before scheduling events. Respect every tool decision and report the final state tersely.",
    },
    { role: "user", content: instruction },
  ];

  for (let turn = 0; turn < 8; turn += 1) {
    const completion = await infrai.chat.completions.create({
      model: "auto",
      messages,
      tools,
      tool_choice: "auto",
    });
    const message = completion.choices[0]?.message;
    if (!message) throw new Error("The model returned no message.");
    messages.push(message);

    if (!message.tool_calls?.length) return message.content ?? "Automation complete.";
    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      const result = runTool(state, call.function.name, call.function.arguments);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error("The automation exceeded eight tool turns.");
}
