// A small stand in for Supabase that keeps every table in one JSON file on disk.
//
// It exists so the whole app can run on a laptop with no hosted database and no
// Docker. The Next server, the seed script and the worker all point at the same
// file, so a room created in the browser is visible to every process. Turn it on
// by starting the app with LOCAL_DB=1 (see the "local" npm script).
//
// It supports only the handful of query shapes the server code actually uses:
// select with eq / in / gte / order / limit / single / maybeSingle, insert,
// upsert with an onConflict key, and update with eq. Realtime is not emulated;
// the room hook already falls back to polling when it cannot subscribe.

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

interface Store {
  fixtures: Row[];
  rooms: Row[];
  members: Row[];
  questions: Row[];
  answers: Row[];
  match_events: Row[];
  match_state: Row[];
  seq: Record<string, number>;
}

const STORE_PATH = process.env.LOCAL_DB_FILE || ".local-db.json";

function emptyStore(): Store {
  return {
    fixtures: [],
    rooms: [],
    members: [],
    questions: [],
    answers: [],
    match_events: [],
    match_state: [],
    seq: {},
  };
}

function readStore(): Store {
  if (!existsSync(STORE_PATH)) return emptyStore();
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    return { ...emptyStore(), ...(JSON.parse(raw) as Partial<Store>) } as Store;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  const dir = dirname(STORE_PATH);
  if (dir && dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

const now = (): string => new Date().toISOString();

// Fills in the columns a fresh row would get from the database defaults, so the
// mappers never see an undefined value.
function withDefaults(table: string, row: Row, store: Store): Row {
  const out: Row = { ...row };
  switch (table) {
    case "rooms":
      if (out.id == null) out.id = randomUUID();
      if (out.created_at == null) out.created_at = now();
      if (out.pool_address === undefined) out.pool_address = null;
      if (out.forfeit_text === undefined) out.forfeit_text = null;
      if (out.status == null) out.status = "open";
      break;
    case "members":
      if (out.id == null) out.id = randomUUID();
      if (out.joined_at == null) out.joined_at = now();
      if (out.deposit_state == null) out.deposit_state = "none";
      if (out.wallet_address === undefined) out.wallet_address = null;
      if (out.is_creator == null) out.is_creator = false;
      break;
    case "questions":
      if (out.id == null) out.id = randomUUID();
      if (out.outcome == null) out.outcome = "pending";
      if (out.resolved_at === undefined) out.resolved_at = null;
      if (out.team === undefined) out.team = null;
      break;
    case "answers":
      if (out.id == null) out.id = randomUUID();
      if (out.locked_at == null) out.locked_at = now();
      break;
    case "match_events": {
      const next = (store.seq.match_events ?? 0) + 1;
      store.seq.match_events = next;
      out.id = next;
      if (out.received_at == null) out.received_at = now();
      break;
    }
    case "match_state":
      if (out.updated_at == null) out.updated_at = now();
      break;
    default:
      break;
  }
  return out;
}

// The natural key each table upserts on when no onConflict is given.
const DEFAULT_CONFLICT: Record<string, string> = {
  fixtures: "id",
  match_state: "fixture_id",
};

interface Filter {
  op: "eq" | "in" | "gte";
  column: string;
  value: unknown;
}

interface Order {
  column: string;
  ascending: boolean;
}

type Op = "select" | "insert" | "upsert" | "update";

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];
  private sortOrder: Order | null = null;
  private limitN: number | null = null;
  private rowMode: "many" | "single" | "maybe" = "many";
  private wantsRows = false;
  private embed: string[] = [];
  private payload: Row[] = [];
  private conflict: string | null = null;

  constructor(
    private readonly table: string,
    private op: Op = "select",
  ) {}

  select(columns = "*"): this {
    // A select after a write asks for the affected rows back.
    if (this.op !== "select") this.wantsRows = true;
    this.embed = parseEmbeds(columns);
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }): this {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = options?.onConflict ?? DEFAULT_CONFLICT[this.table] ?? "id";
    return this;
  }

  update(patch: Row): this {
    this.op = "update";
    this.payload = [patch];
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.sortOrder = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitN = count;
    return this;
  }

  single(): this {
    this.rowMode = "single";
    return this;
  }

  maybeSingle(): this {
    this.rowMode = "maybe";
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const cell = row[f.column];
      if (f.op === "eq") return cell === f.value;
      if (f.op === "in") return (f.value as unknown[]).includes(cell);
      if (f.op === "gte") return (cell as string) >= (f.value as string);
      return true;
    });
  }

  private shape(rows: Row[]): { data: unknown; error: unknown } {
    let out = rows.map((r) => embedRelations(r, this.table, this.embed));
    if (this.sortOrder) {
      const { column, ascending } = this.sortOrder;
      out = [...out].sort((a, b) => {
        const av = a[column] as string | number;
        const bv = b[column] as string | number;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    if (this.rowMode !== "many") {
      return { data: out.length > 0 ? out[0] : null, error: null };
    }
    return { data: out, error: null };
  }

  private run(): { data: unknown; error: unknown } {
    const store = readStore();
    const table = store[this.table as keyof Store] as Row[];
    if (!Array.isArray(table)) {
      return { data: null, error: { message: `Unknown table ${this.table}` } };
    }

    if (this.op === "select") {
      return this.shape(table.filter((r) => this.matches(r)));
    }

    if (this.op === "insert") {
      const added = this.payload.map((r) => withDefaults(this.table, r, store));
      table.push(...added);
      writeStore(store);
      return this.wantsRows ? this.shape(added) : { data: null, error: null };
    }

    if (this.op === "upsert") {
      const keys = this.conflict!.split(",").map((k) => k.trim());
      const affected: Row[] = [];
      for (const incoming of this.payload) {
        const idx = table.findIndex((existing) =>
          keys.every((k) => existing[k] === incoming[k]),
        );
        if (idx >= 0) {
          table[idx] = { ...table[idx], ...incoming };
          affected.push(table[idx]);
        } else {
          const created = withDefaults(this.table, incoming, store);
          table.push(created);
          affected.push(created);
        }
      }
      writeStore(store);
      return this.wantsRows ? this.shape(affected) : { data: null, error: null };
    }

    // update
    const patch = this.payload[0] ?? {};
    const affected: Row[] = [];
    for (let i = 0; i < table.length; i++) {
      if (this.matches(table[i])) {
        table[i] = { ...table[i], ...patch };
        affected.push(table[i]);
      }
    }
    writeStore(store);
    return this.wantsRows ? this.shape(affected) : { data: null, error: null };
  }
}

// Pulls embedded resource names out of a select string like "*, fixtures(*)".
function parseEmbeds(columns: string): string[] {
  const embeds: string[] = [];
  const regex = /([a-z_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(columns)) !== null) {
    embeds.push(match[1]);
  }
  return embeds;
}

// Attaches an embedded parent row, matching Supabase's "rooms(*, fixtures(*))"
// style. Only the fixtures relation is used, joined on fixture_id.
function embedRelations(row: Row, _table: string, embeds: string[]): Row {
  if (embeds.length === 0) return row;
  const store = readStore();
  const out: Row = { ...row };
  for (const name of embeds) {
    const parent = store[name as keyof Store] as Row[] | undefined;
    if (!Array.isArray(parent)) continue;
    const fk = `${name.replace(/s$/, "")}_id`;
    out[name] = parent.find((p) => p.id === row[fk]) ?? null;
  }
  return out;
}

class LocalClient {
  from(table: string): Query {
    return new Query(table);
  }
}

let cached: LocalClient | null = null;

export function localDb(): SupabaseClient {
  if (!cached) cached = new LocalClient();
  return cached as unknown as SupabaseClient;
}
