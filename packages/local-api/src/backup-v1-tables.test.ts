import { runMigrations } from "@starter/local-db/migrate";
import { createNodeExecutor } from "@starter/local-db/node-executor";
import { describe, expect, it } from "vitest";

import { commands, createLocalApi } from "./api";
import type { CommandResult } from "./command";

function ok<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.data;
}

async function freshApi() {
  const executor = createNodeExecutor();
  await runMigrations(executor);
  return { executor, api: createLocalApi({ executor, clock: () => 1_800_000_000_000 }) };
}

const plan = {
  id: "01900000-0000-7000-8000-000000000001",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  planKey: "john-21",
  title: "Gospel of John",
  definition: null,
  startedOn: "2026-11-01",
  finishedAt: null,
  leftAt: null,
};

describe("backups include plans, plan progress and bookmarks", () => {
  it("round-trips the new tables into an empty database", async () => {
    const source = await freshApi();
    await source.executor.run(
      "INSERT INTO plans (id, created_at, updated_at, plan_key, title, started_on) VALUES (?, 1, 1, ?, ?, ?)",
      [plan.id, plan.planKey, plan.title, plan.startedOn],
    );
    await source.executor.run(
      "INSERT INTO plan_progress (id, created_at, updated_at, plan_id, day, completed_at) VALUES (?, 1, 1, ?, 1, 5)",
      ["01900000-0000-7000-8000-000000000002", plan.id],
    );
    await source.executor.run(
      "INSERT INTO bookmarks (id, created_at, updated_at, start_vid, end_vid, label) VALUES (?, 1, 1, ?, ?, ?)",
      ["01900000-0000-7000-8000-000000000003", 43_003_016, 43_003_016, "Start here"],
    );
    const file = ok(await source.api.run(commands.backup.export, {}));
    expect(file.data.plans).toHaveLength(1);
    expect(file.data.planProgress).toHaveLength(1);
    expect(file.data.bookmarks).toHaveLength(1);

    const target = await freshApi();
    const report = ok(await target.api.run(commands.backup.import, { json: JSON.stringify(file) }));
    expect(report.changed).toMatchObject({ plans: 1, planProgress: 1, bookmarks: 1 });
    const again = ok(await target.api.run(commands.backup.export, {}));
    expect(again.data.plans).toEqual(file.data.plans);
    expect(again.data.planProgress).toEqual(file.data.planProgress);
    expect(again.data.bookmarks).toEqual(file.data.bookmarks);
  });

  it("imports a backup written before these tables existed", async () => {
    const { api } = await freshApi();
    const old = { format: "bibleos-study-backup", version: 1, exportedAt: 1, data: { notes: [], settings: [] } };
    const report = ok(await api.run(commands.backup.import, { json: JSON.stringify(old) }));
    expect(report.changed.plans).toBe(0);
  });

  it("rejects plan progress that points at a missing plan", async () => {
    const { api } = await freshApi();
    const broken = {
      format: "bibleos-study-backup",
      version: 1,
      exportedAt: 1,
      data: {
        planProgress: [
          { id: "p", createdAt: 1, updatedAt: 1, deletedAt: null, planId: "missing", day: 1, completedAt: 1 },
        ],
      },
    };
    const result = await api.run(commands.backup.import, { json: JSON.stringify(broken) });
    expect(result.ok).toBe(false);
  });
});
