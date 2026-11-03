import { chapterRange } from "@starter/bible-core/range";
import { verseIdFromCode } from "@starter/bible-core/verse-id";
import type { SqliteExecutor } from "@starter/local-db/executor";
import { runMigrations } from "@starter/local-db/migrate";
import { createNodeExecutor } from "@starter/local-db/node-executor";
import { beforeEach, describe, expect, it } from "vitest";

import { commands, createLocalApi, type LocalApi } from "./api";
import type { Command, CommandResult } from "./command";

const v = (code: string, chapter: number): number => verseIdFromCode(code, chapter) ?? 0;

function ok<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.data;
}
const code = <T>(result: CommandResult<T>) => (result.ok ? "OK" : result.error.code);

let executor: SqliteExecutor;
let api: LocalApi;
let clock: number;
const run = <I, O>(command: Command<I, O>, input: I) => {
  clock += 1000;
  return api.run(command, input);
};

beforeEach(async () => {
  executor = createNodeExecutor();
  await runMigrations(executor);
  clock = 1_760_000_000_000;
  api = createLocalApi({ executor, clock: () => clock });
});

const startJohn = () => run(commands.plans.start, { kind: "builtIn", planKey: "john-21", startedOn: "2026-11-01" });

describe("plans", () => {
  it("starts a built-in plan with its days and lists it as active", async () => {
    const plan = ok(await startJohn());
    expect(plan).toMatchObject({ key: "john-21", status: "active", startedOn: "2026-11-01", completedDays: [] });
    expect(plan.days).toHaveLength(21);
    expect(plan.days[0]).toEqual([chapterRange(v("JHN", 1))]);
    expect(ok(await run(commands.plans.list, {})).map((p) => p.id)).toEqual([plan.id]);
    expect(ok(await run(commands.plans.get, { id: plan.id })).id).toBe(plan.id);
  });

  it("refuses to start the same built-in plan twice while active", async () => {
    ok(await startJohn());
    expect(code(await startJohn())).toBe("CONFLICT");
  });

  it("rejects bad dates and missing plans", async () => {
    const bad = await run(commands.plans.start, { kind: "builtIn", planKey: "john-21", startedOn: "1 Nov" });
    expect(code(bad)).toBe("INVALID_INPUT");
    expect(code(await run(commands.plans.get, { id: "missing" }))).toBe("NOT_FOUND");
    expect(code(await run(commands.plans.leave, { id: "missing" }))).toBe("NOT_FOUND");
  });

  it("completes and un-completes days, finishing the plan on the last one", async () => {
    const plan = ok(
      await run(commands.plans.start, {
        kind: "custom",
        title: "Jude",
        books: ["JUD"],
        days: 1,
        startedOn: "2026-11-01",
      }),
    );
    expect(plan.days).toHaveLength(1);
    const done = ok(await run(commands.plans.completeDay, { planId: plan.id, day: 1 }));
    expect(done).toMatchObject({ status: "finished", completedDays: [1] });
    // Completing twice is a no-op.
    ok(await run(commands.plans.completeDay, { planId: plan.id, day: 1 }));
    const undone = ok(await run(commands.plans.uncompleteDay, { planId: plan.id, day: 1 }));
    expect(undone).toMatchObject({ status: "active", completedDays: [] });
    // The unique (plan, day) row is revived, not duplicated.
    expect(ok(await run(commands.plans.completeDay, { planId: plan.id, day: 1 })).completedDays).toEqual([1]);
    expect(await executor.all("SELECT day FROM plan_progress")).toHaveLength(1);
  });

  it("rejects a day outside the plan", async () => {
    const plan = ok(await startJohn());
    expect(code(await run(commands.plans.completeDay, { planId: plan.id, day: 22 }))).toBe("INVALID_INPUT");
    expect(code(await run(commands.plans.completeDay, { planId: plan.id, day: 0 }))).toBe("INVALID_INPUT");
  });

  it("leaves a plan keeping progress, resumes it, and restarts it", async () => {
    const plan = ok(await startJohn());
    ok(await run(commands.plans.completeDay, { planId: plan.id, day: 1 }));
    ok(await run(commands.plans.completeDay, { planId: plan.id, day: 2 }));
    const left = ok(await run(commands.plans.leave, { id: plan.id }));
    expect(left).toMatchObject({ status: "left", completedDays: [1, 2] });
    expect(left.leftAt).not.toBeNull();
    // A left plan cannot be ticked, and the same plan can be started fresh.
    expect(code(await run(commands.plans.completeDay, { planId: plan.id, day: 3 }))).toBe("CONFLICT");
    ok(await startJohn());

    const resumed = ok(await run(commands.plans.resume, { id: plan.id }));
    expect(resumed).toMatchObject({ status: "active", leftAt: null, completedDays: [1, 2] });

    const restarted = ok(await run(commands.plans.restart, { id: plan.id, startedOn: "2026-12-01" }));
    expect(restarted).toMatchObject({ status: "active", startedOn: "2026-12-01", completedDays: [] });
  });

  it("stores a custom plan definition as validated JSON", async () => {
    const plan = ok(
      await run(commands.plans.start, {
        kind: "custom",
        title: "Romans and Galatians",
        books: ["gal", "ROM"],
        days: 11,
        startedOn: "2026-11-01",
      }),
    );
    expect(plan).toMatchObject({ key: "custom", custom: true, title: "Romans and Galatians" });
    expect(plan.days).toHaveLength(11);
    expect(plan.days[0]?.[0]).toEqual(chapterRange(v("ROM", 1)));
    const [row] = await executor.all("SELECT definition FROM plans");
    expect(JSON.stringify(row)).toContain('\\"books\\":[\\"GAL\\",\\"ROM\\"]');
    expect(
      code(
        await run(commands.plans.start, {
          kind: "custom",
          title: "x",
          books: ["XYZ"],
          days: 3,
          startedOn: "2026-11-01",
        }),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("writes change_log rows for plan mutations", async () => {
    const plan = ok(await startJohn());
    ok(await run(commands.plans.completeDay, { planId: plan.id, day: 1 }));
    ok(await run(commands.plans.leave, { id: plan.id }));
    ok(await run(commands.plans.list, {}));
    const log = await executor.all("SELECT entity, entity_id, action FROM change_log ORDER BY at, id");
    expect(log).toEqual([
      { entity: "plans", entity_id: plan.id, action: "start" },
      { entity: "plans", entity_id: plan.id, action: "completeDay" },
      { entity: "plans", entity_id: plan.id, action: "leave" },
    ]);
  });
});
