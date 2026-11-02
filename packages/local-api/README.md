# @starter/local-api

Commands over the study database: the desktop's version of the web stack's tRPC routers.

```ts
const executor = /* platform executor, see @starter/local-db README */;
await runMigrations(executor);
const api = createLocalApi({ executor, logger });
const result = await api.run(commands.notes.save, { kind: "note", title, body, tags, anchors });
if (result.ok) result.data; else result.error.code; // INVALID_INPUT | NOT_FOUND | CONFLICT | INTERNAL
```

- `src/command.ts`: `defineCommand`, the one checkpoint (Zod input, transaction and `change_log` row
  for mutations, typed results, logging without contents).
- `src/commands/*.ts`: rules. `src/services/*.ts`: queries only.
- `src/schemas.ts`: shared Zod schemas, limits, highlight colours, `preferencesSchema` + `DEFAULT_PREFERENCES`.
- `src/api.ts`: the `commands` registry and `createLocalApi`. Types for hooks: `CommandInput<C>` / `CommandOutput<C>`.

| Command                                                            | Kind                      |
| ------------------------------------------------------------------ | ------------------------- |
| `highlights.set` / `remove` / `list`                               | mutation, mutation, query |
| `notes.save` / `delete` / `restore` / `get` / `list` / `backlinks` | 3 mutations, 3 queries    |
| `collections.create` / `addItem` / `removeItem` / `list`           | 3 mutations, 1 query      |
| `reading.recordSession` / `markChapterRead` / `summary`            | 2 mutations, 1 query      |
| `settings.get` / `set`                                             | query, mutation           |
| `backup.export` / `import`                                         | query, mutation           |
