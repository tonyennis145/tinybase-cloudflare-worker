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

export default {
  fetch: getWsServerDurableObjectFetch('TINYBASE'),
};
