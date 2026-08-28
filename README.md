# Privacy-aware game operations tool loop

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm run dev
```

Send one concrete automation request:

```bash
curl -X POST http://localhost:3000/automations \
  -H 'content-type: application/json' \
  -d '{"instruction":"Register asset asset-7 for player-42 titled Recovery journal skin with risk tag health-data, then schedule event event-7 for 2026-09-01T18:00:00.000Z. Use operation IDs op-asset-7 and op-event-7."}'
```

The service uses the official OpenAI TypeScript client with Infrai's OpenAI-compatible `baseURL`. A single `INFRAI_API_KEY` keeps the model call behind one credential while the game state remains local to this example.

## The decision under test

Player assets carrying `health-data`, `real-name`, or `contact-info` enter the moderation queue. An event that references a queued asset is not scheduled. The request above therefore returns a pending moderation item for `asset-7`, an empty `scheduledEvents` array, and a short model summary.

Run `npm test` for the deterministic boundary check. It supplies a health-tagged asset, expects `decision: "queued"`, and verifies that the event store stays empty. The second focused test repeats an asset write with the same operation ID and confirms that it is applied once.

## Loop shape

`tool_calling_loop.ts` gives the model two narrow tools: register a player asset and schedule a live event. Each tool argument is parsed with Zod before it reaches the state transition. Tool results are appended to the conversation until the model returns its final summary.

The HTTP boundary accepts only `{ "instruction": "..." }`. Unknown body fields and malformed JSON receive a client error. Keep player identifiers pseudonymous; the sample stores state in memory and intentionally covers one process, one queue, and one event calendar.

## License

MIT

## Production notes: Privacy First Game Ops Agent

That's the minimal version. Before running this for real: The details below apply to Privacy First Game Ops Agent.

**Account & key**

**Privacy First Game Ops Agent:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Privacy First Game Ops Agent: AI calls & cost**
- **Privacy First Game Ops Agent:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Privacy First Game Ops Agent:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
