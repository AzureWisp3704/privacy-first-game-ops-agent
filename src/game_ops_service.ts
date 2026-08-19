import { createServer } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { createGameState } from "./game_backend.js";
import { runGameOpsAgent } from "./tool_calling_loop.js";

const requestBody = z.object({ instruction: z.string().min(1).max(4000) }).strict();
const state = createGameState();

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/automations") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = requestBody.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const summary = await runGameOpsAgent(state, body.instruction);
    response.writeHead(200).end(JSON.stringify({
      summary,
      state: {
        assetCount: state.assets.size,
        scheduledEvents: [...state.events.values()],
        moderationQueue: [...state.moderationQueue.values()],
      },
    }));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid request body" }));
      return;
    }
    if (error instanceof OpenAI.APIError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.message }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "automation request failed" }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Game operations service listening on http://localhost:${port}`));
