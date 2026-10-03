# TinyBase sync server on Cloudflare Workers

A tiny [TinyBase](https://tinybase.org) sync server. Browsers (or any TinyBase client) connect over WebSockets and keep a `MergeableStore` in sync with each other. The server keeps a copy of every store, so a new device gets all the data when it first connects.

It's about 20 lines of code: TinyBase's own `WsServerDurableObject`, running on Cloudflare Workers with Durable Objects.

## How it works

- **Each URL path is a separate store (a "room").** `wss://<your-worker>/magnet` and `wss://<your-worker>/crm` are two unrelated stores. Rooms are created the first time someone connects; there's nothing to set up per app.
- **Each room is its own Durable Object.** It relays changes between connected clients and saves the store in the Durable Object's built-in SQLite storage (`createDurableObjectSqlStoragePersister`). The data survives restarts and redeploys.
- **Merging is TinyBase's CRDT:** last write wins per cell, so clients that were offline merge cleanly when they reconnect.

## Deploy it

You need a Cloudflare account. SQLite-backed Durable Objects are available on the free Workers plan.

### Option A: from the Cloudflare dashboard (no local setup)

1. Fork or copy this repository to your own GitHub account.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**, and pick your copy.
3. Leave the build settings as they are and deploy. Cloudflare installs the packages and runs `wrangler deploy` for you.
4. Every push to the repository redeploys it.

### Option B: from your computer

```sh
npm install
npx wrangler login      # opens a browser to sign in to Cloudflare
npx wrangler deploy
```

Either way, the Worker is published at `https://<name>.<your-subdomain>.workers.dev`, where `<name>` comes from `wrangler.jsonc` (`tinybase-magnet` here; change it before your first deploy if you like). Clients connect with `wss://` instead of `https://`.

### Run it locally

```sh
npx wrangler dev        # serves on ws://localhost:8787/<room>
```

## Connect a client

In the browser (no build step needed):

```js
import { createMergeableStore } from 'https://esm.sh/tinybase@10.0.1';
import { createWsSynchronizer } from 'https://esm.sh/tinybase@10.0.1/synchronizers/synchronizer-ws-client';

const store = createMergeableStore();
const synchronizer = await createWsSynchronizer(store, new WebSocket('wss://<your-worker>.workers.dev/my-app'));
await synchronizer.startSync();

store.setRow('notes', 'n1', { text: 'Hello from another device' });
```

Open the same page in two browsers and changes appear in both. For a local copy that survives reloads and offline use, also add a persister such as `createIndexedDbPersister` from `tinybase/persisters/persister-indexed-db`.

## Things to know

- **Rooms are open unless you protect them.** Anyone who knows (or guesses) an unprotected room's URL can read and change its data. To lock a room, add a Worker secret named `PROTECTED_ROOMS`: a JSON object of room name to the SHA-256 (hex) of a key, e.g. `{"crm":"9f86d0…"}`. That room then only accepts `wss://…/crm?key=<key>`; a wrong or missing key gets a 403. `GET https://…/<room>?locked` answers `{"locked": true}` or `false`, so a page can check a room is locked before syncing into it. Use long random keys, and keep secrets and personal data out of unprotected rooms.
- **Use the same TinyBase version on the server and in clients.** `package.json` installs `latest`; pinning it (e.g. `"tinybase": "10.0.1"`) avoids a server upgrade quietly changing the sync protocol under older clients.
- **Deleted rows are kept as small "tombstones"** so that every device learns about the deletion. A store that has had lots of rows added and then deleted stays bigger than its live data suggests.
- **A client that reconnects after making changes offline may not upload them on its own.** The server's catch-up request can time out on large stores. If that matters for your app, have the client compare its data with the server's after reconnecting and re-send anything missing as normal edits.

## Files

- `src/index.js`: the Worker. A Durable Object class that sets up storage, plus a `fetch` handler that sends each WebSocket to its room.
- `wrangler.jsonc`: the Worker's name, the Durable Object binding (`TINYBASE`) and the migration that creates its SQLite-backed class.
- `package.json`: `tinybase` and `wrangler`.
