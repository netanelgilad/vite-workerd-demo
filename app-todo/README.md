# app-todo — a real Vite + React + TypeScript ToDo app

A working ToDo app meant to be served by the existing `harness/` (Vite build +
dev server running inside workerd). It is the app the later "DO as a JS machine"
integration will serve.

## Behavior

- Add a todo (Enter or the Add button; blank input is rejected)
- Toggle complete (checkbox; completed items get a strikethrough)
- Delete a todo
- Filter: all / active / completed
- "items left" counter and "Clear completed"
- **Persistence**: todos are stored in `localStorage` (`app-todo.todos.v1`) and
  survive a page reload.

Stack: Vite 8 (Rolldown) + React 19 + TypeScript + Tailwind CSS v3 (PostCSS +
autoprefixer). Components are pure UI; all state/logic lives in
`src/hooks/useTodos.ts` (which uses `src/hooks/useLocalStorage.ts`).

## Run it through the workerd harness

```bash
# byte-identical build check (host Node vite vs vite-inside-workerd)
cd harness && SPIKE_APP_DIR=../app-todo npm run verify:build      # -> byte-identical: 4/4

# dev server inside workerd, on a real port
cd harness && SPIKE_APP_DIR=../app-todo PORT=5174 npm run dev     # open http://127.0.0.1:5174
```

`SPIKE_APP_DIR` is the harness's app selector (see `harness/host.mjs`).

## Harness deps

No harness change was needed: `host.mjs` `APP_DEP_PACKAGES` already includes
`react`, `react-dom`, `scheduler`, `react-refresh`, `@vitejs/plugin-react`, and
`tailwindcss` — which is exactly this app's runtime set. (This app does NOT use
react-router or @tanstack/react-query, which are listed `optional` in the
manifest and simply skipped.)

## Proof

`proof-screenshots/` contains a real-browser run (Playwright via the dev-browser
skill) against the workerd dev server: initial empty state, two todos added, one
toggled complete (strikethrough + "1 item left"), one deleted, and the active
filter. DOM assertions for add / toggle / delete / filter / localStorage-reload
all passed.
