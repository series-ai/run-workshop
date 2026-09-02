# Emberline Agent NPC

This React and Vite RUN app shows how to use `@series-inc/rundot-agent` for a game NPC.

The project pins the public `@series-inc/rundot-agent@0.1.0-beta.2` package. The [npm package page](https://www.npmjs.com/package/@series-inc/rundot-agent) contains the runtime API documentation.

The example includes:

- streamed NPC replies;
- game tools with visible progress;
- a durable NPC question;
- approval and rejection for a game action;
- reload recovery for pending input;
- compare-and-swap storage for safe multiple-tab use;
- a clear conflict and reload path for a stale tab;
- stop, retry, error, reset, and RUN pause handling;
- an offline model fixture for local tests;
- the real RUN TextGen adapter for playground and deployed builds.

## Start offline

Install dependencies from this directory. Offline mode uses a deterministic model fixture. It makes no network request and spends no credits.

```bash
npm install
npm run dev:offline
```

Open `http://127.0.0.1:5183`.

Use these prompts to see each state:

- `What is that tower listening for?`
- `Look around. What has changed tonight?`
- `Help me choose which path to take.`
- `I want to take the signal job.`

Reload while the route question is open. The question and transcript must return.

Open the app in two tabs. The second tab becomes the current writer. A send from the first tab must show `This chat moved in another tab.` Select `Load latest` to reopen safely.

## Use the RUN playground

The normal development command uses the RUN playground and the real TextGen adapter.

```bash
rundot login
rundot playground grant-access
npm run dev
```

The access command writes a playground key to the local `.env.local` file. Do not commit that file or key.

Normal mode uses:

```ts
createTextGenTransport(RundotGameAPI.textGen, {
  mode: 'open',
  modelClass: 'standard',
})
```

The playground needs a signed-in creator and a valid game. It can spend credits.

## Validation

Run the fast checks:

```bash
npm run ci
```

Run the complete browser checks:

```bash
npm run test:e2e
```

The browser suite uses offline mode. It checks direct text, a read-only tool, a durable question across reload, approval, rejection, and multiple-tab writer fencing.

## Source map

- `src/agent/npcAgent.ts` defines Mira, her tools, the RUN adapters, and the durable session.
- `src/agent/runtimeCoordinator.ts` serializes load, reopen, and reset operations.
- `src/agent/offlineNpcTransport.ts` supplies deterministic local model behavior.
- `src/chat/useNpcChat.ts` maps agent events and run results into React actions.
- `src/chat/chatState.ts` owns the display state.
- `src/ui/DecisionTray.tsx` renders durable questions and approvals.
- `src/ui/App.tsx` composes the complete chat surface.
- `e2e/npc-chat.spec.ts` proves the main player flows and two-tab behavior.

## Storage and multiple tabs

The session store uses RUN `appStorage` with compare-and-swap mode.

```ts
createVenusSessionStore(RundotGameAPI.appStorage, {
  namespace: 'agent-reference/emberline',
  concurrency: 'compare_and_swap',
})
```

Each open writer fences the prior writer. A stale writer cannot publish a later session head. The UI treats `CONFLICT` as a recoverable state and requires an explicit reload.

The NPC session uses the stable ID `emberline-mira-v1`. Change the ID or namespace when you adapt this example for another NPC or save slot.

## Adapt the NPC

Replace these parts first:

1. Change the instructions in `src/agent/npcAgent.ts`.
2. Replace the sample world data with game state reads.
3. Replace `accept_quest` with a game command that is safe to retry or that requires approval.
4. Keep tool results as the source of truth for completed game actions.
5. Keep compare-and-swap mode when the same save can open in more than one tab or device.

Do not put secrets in the system prompt, tool input, logs, or browser storage.

## Build and deploy

Build the app:

```bash
npm run build
```

Bind your own RUN game before deployment. The workshop does not track account-specific game configuration.

```bash
rundot init
```

Then confirm the checks and deploy.

```bash
npm run ci:full
npm run deploy
```

The app includes a conservative TextGen credit policy in `rundot/textGen.config.json`. Review the limits before you publish a derived game.
