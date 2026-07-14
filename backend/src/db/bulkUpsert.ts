/**
 * Shared bulk upsert helper (Phase 8A/8B).
 *
 * Replaces "N × prisma.model.upsert() fanned out with mapSettledWithConcurrency"
 * with a single (or few, chunked) `INSERT ... ON CONFLICT DO UPDATE` statement.
 * One raw query = one dbGate slot, regardless of row count, instead of up to
 * `WRITE_CONCURRENCY` slots held simultaneously per batch.
 *
 * Raw queries bypass Prisma's `$allModels` query extension (see prisma.ts), so
 * this helper explicitly holds a dbGate slot for the whole statement via
 * `runWithDbSlot`.
 *
 * Raw SQL also bypasses Prisma's automatic `@updatedAt` handling — callers
 * must include an explicit `updatedAt` value in every row.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { runWithDbSlot } from "./dbGate";

export interface BulkUpsertOptions<Row> {
  /** Snake_case table name (matches `@@map(...)` in schema.prisma). */
  table: string;
  /** Column names in the exact order `toRow` returns values. */
  columns: string[];
  /** Unique constraint columns used as the `ON CONFLICT (...)` target. */
  conflictColumns: string[];
  /** Columns to overwrite on conflict. Columns outside this list (and outside
   * `columns`) keep their existing DB value — e.g. fields owned by other
   * write paths such as `battingHand` or `historicalChallengeAttempts`. */
  updateColumns: string[];
  /** Maps one input row to positional values matching `columns`. */
  toRow: (row: Row) => unknown[];
  /** Optional Postgres type cast per column (e.g. `{ buckets: "jsonb" }`). */
  casts?: Record<string, string>;
  /** Rows per statement. Defaults to 500 — well under Postgres' bind-param cap. */
  chunkSize?: number;
}

export interface BulkUpsertResult {
  /** Total rows submitted across all chunks. */
  attempted: number;
  /** Number of `INSERT ... ON CONFLICT` statements executed. */
  chunks: number;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function valueFragment(value: unknown, cast?: string): Prisma.Sql {
  const bound = value === undefined ? null : value;
  return cast ? Prisma.sql`${bound}::${Prisma.raw(cast)}` : Prisma.sql`${bound}`;
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bulk `INSERT ... ON CONFLICT DO UPDATE` for a batch of rows.
 *
 * No-ops on an empty batch. Chunks large batches into multiple statements
 * (each still a single dbGate slot) rather than one unbounded statement.
 */
export async function bulkUpsert<Row>(
  rows: readonly Row[],
  options: BulkUpsertOptions<Row>
): Promise<BulkUpsertResult> {
  if (rows.length === 0) return { attempted: 0, chunks: 0 };

  const chunkSize = options.chunkSize ?? 500;
  const chunks = chunkArray(rows, chunkSize);

  for (const chunk of chunks) {
    await runWithDbSlot(() => executeChunk(chunk, options));
  }

  return { attempted: rows.length, chunks: chunks.length };
}

async function executeChunk<Row>(
  chunk: readonly Row[],
  options: BulkUpsertOptions<Row>
): Promise<void> {
  const columnsSql = Prisma.raw(options.columns.map(quoteIdent).join(", "));
  const conflictSql = Prisma.raw(options.conflictColumns.map(quoteIdent).join(", "));
  const updateSql = Prisma.raw(
    options.updateColumns
      .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
      .join(", ")
  );

  const rowsSql = Prisma.join(
    chunk.map((row) => {
      const values = options.toRow(row);
      const fragments = options.columns.map((col, i) =>
        valueFragment(values[i], options.casts?.[col])
      );
      return Prisma.sql`(${Prisma.join(fragments)})`;
    })
  );

  const sql = Prisma.sql`
    INSERT INTO ${Prisma.raw(quoteIdent(options.table))} (${columnsSql})
    VALUES ${rowsSql}
    ON CONFLICT (${conflictSql})
    DO UPDATE SET ${updateSql}
  `;

  await prisma.$executeRaw(sql);
}
