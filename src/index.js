import { createMergeableStore } from 'tinybase';

import { createDurableObjectSqlStoragePersister }
  from 'tinybase/persisters/persister-durable-object-sql-storage';

import {
  WsServerDurableObject,
  getWsServerDurableObjectFetch,
} from 'tinybase/synchronizers/synchronizer-ws-server-durable-object';


export class TinyBaseDurableObject extends WsServerDurableObject {
  createPersister() {
    return createDurableObjectSqlStoragePersister(
      createMergeableStore(),
      this.ctx.storage.sql,
    );
  }
}

const tinybaseFetch = getWsServerDurableObjectFetch('TINYBASE');

const sha256Hex = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

// Optional room keys. PROTECTED_ROOMS is a JSON object of room name -> SHA-256 (hex) of that room's key, set as a
// Worker secret, e.g. {"crm":"9f86d0…"}. A protected room only accepts connections to wss://…/<room>?key=<key>.
// Rooms not listed stay open to anyone with the URL. The 403 allows any origin so a page can check a room is locked
// (connect with a wrong key, expect 403) before syncing anything sensitive into it.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const room = decodeURIComponent(url.pathname.slice(1));
    let rooms = {};
    try { rooms = JSON.parse(env.PROTECTED_ROOMS || '{}'); } catch {}
    if (rooms[room] && (await sha256Hex(url.searchParams.get('key') || '')) !== rooms[room]) {
      return new Response('This room needs a valid key.', { status: 403, headers: { 'access-control-allow-origin': '*' } });
    }
    return tinybaseFetch(request, env, ctx);
  },
};
