import { AsyncLocalStorage } from "node:async_hooks";

import { SQL } from "bun";
import { Kysely, sql, type Transaction } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";

// Transaction-in-context, ported from the Go internal/pgtx package: the active
// transaction is carried implicitly so repositories transparently join the
// caller's unit of work (pgtx.With/Or) and nested runInTx reuses it. Stored as
// Kysely<any> because Kysely is invariant in its DB param — each Database casts
// back to its own DB type on read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txCtx = new AsyncLocalStorage<Kysely<any>>();

/**
 * Database wraps a Kysely instance bound to one logical database, on Bun's
 * native `SQL` driver via the kysely-postgres-js dialect.
 *
 * `db` returns the active transaction inside runInTx, otherwise the root pool
 * (pgtx.Or). `runInTx` runs fn in a transaction; a nested call reuses the
 * in-flight tx so the whole unit of work commits atomically (pgtx.RunInTx).
 */
export class Database<DB> {
  readonly root: Kysely<DB>;

  // poolMax caps the underlying Bun SQL connection pool. Bun's default is large;
  // on a single small VM many service pools would exhaust Postgres's
  // max_connections, so default to a modest 10 (override per service).
  constructor(url: string, opts: { poolMax?: number } = {}) {
    this.root = new Kysely<DB>({
      dialect: new PostgresJSDialect({ postgres: new SQL(url, { max: opts.poolMax ?? 10 }) }),
    });
  }

  get db(): Kysely<DB> {
    return (txCtx.getStore() as Kysely<DB> | undefined) ?? this.root;
  }

  runInTx<T>(fn: (tx: Kysely<DB>) => Promise<T>): Promise<T> {
    const existing = txCtx.getStore() as Kysely<DB> | undefined;
    if (existing) return fn(existing); // nested → reuse the in-flight tx
    return this.root.transaction().execute((trx: Transaction<DB>) =>
      txCtx.run(trx, () => fn(trx)),
    );
  }

  /** Liveness probe for /up — mirrors db.Pools.Ping. */
  async ping(): Promise<void> {
    await sql`select 1`.execute(this.root);
  }

  close(): Promise<void> {
    return this.root.destroy();
  }
}
