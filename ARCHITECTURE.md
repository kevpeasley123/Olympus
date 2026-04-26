# Olympus Architecture Discovery

This file documents the current state of the Olympus project as inspected on April 25, 2026.

## 1. Stack identification

### Frontend framework
- **Frontend:** React
- **Build tool / dev server:** Vite
- **Desktop shell:** Tauri

Evidence:
- `src/main.tsx` mounts a React app with `ReactDOM.createRoot(...)`
- `vite.config.ts` configures Vite
- `src-tauri/` contains a Tauri/Rust desktop shell

### `package.json` — key dependencies

From `package.json`:

#### Runtime dependencies
- `react`
- `react-dom`
- `lucide-react`
- `@tauri-apps/api`

#### Dev dependencies
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `@types/react`
- `@types/react-dom`
- `@tauri-apps/cli`
- `esbuild`

### Is there a backend already?
- **Yes, but not a traditional web backend.**
- There is **no Express server**, **no FastAPI app**, **no `server.js`**, and **no `api/` directory** for HTTP routes.
- There **is** a **Tauri backend** in Rust at:
  - `src-tauri/src/main.rs`
  - `src-tauri/schema.sql`

Current Tauri commands found:
- `initialize_database`
- `write_memory_artifact`
- `launch_quick_app`

So the project currently has:
- a React/Vite frontend
- a Tauri/Rust native bridge for desktop behavior
- SQLite schema support in the desktop layer

### Languages in the project
- **TypeScript / TSX** — frontend app logic and UI
- **CSS** — dashboard styling
- **Rust** — Tauri desktop backend
- **SQL** — SQLite schema
- **PowerShell** — vault/bootstrap/sync scripts
- **JSON** — config files
- **HTML** — `index.html`

### How the app is currently launched

From `package.json`:

- **Frontend dev:** `npm run dev`
- **Production build:** `npm run build`
- **Preview build:** `npm run preview`
- **Tauri CLI entry:** `npm run tauri`

Based on `README.md`, intended local launch patterns are:

```bash
npm install
npm run dev
```

and for desktop:

```bash
npm run tauri dev
```

## 2. Data flow

### Where current dashboard values come from
- The dashboard values are currently **seeded / hardcoded in app state**, not fetched from a live API.
- The primary source is:
  - `src/data/seed.ts`

Examples currently found there:
- market index values like `5,214.18`
- treasury rates like `4.88%`
- weather like `Phoenix, AZ` and `74 F`
- tracked project metadata
- research starter entries
- chat starter messages
- quickbar app definitions
- now-playing placeholder content

### State management
- State management is currently **plain React state** with `useState`, `useEffect`, and `useMemo`
- There is **no Redux**
- There is **no Zustand**
- There is **no external state library**

The root dashboard state is loaded here:
- `src/App.tsx`

Persistence is handled here:
- `src/services/storage.ts`

Current persistence approach:
- browser `localStorage`
- seeded fallback from `src/data/seed.ts`

### Are there any API calls happening currently?
- **No external HTTP API calls were found in the app code.**
- I did **not** find active `fetch(...)` or `axios` usage for live dashboard data.

What does exist:
- Tauri command invocations via `@tauri-apps/api/core`
- Example files:
  - `src/services/tauri.ts`
  - `src/services/launcher.ts`

These are **native bridge calls**, not network API calls.

## 3. File structure

### Project tree

The user requested:

```bash
tree -L 3 -I 'node_modules|.git|dist|build'
```

This project is on Windows PowerShell, where `tree` does not support `-L` and `-I` in the same way as Unix tooling. I used a PowerShell equivalent to list the project to depth 3 while excluding `node_modules`, `.git`, `dist`, and `build`.

Equivalent output:

```text
[D] scripts
[D] src
[D] src-tauri
[F] .gitignore
[F] index.html
[F] package-lock.json
[F] package.json
[F] README.md
[F] tsconfig.json
[F] vite.config.ts
[F] scripts\create-obsidian-map.ps1
[F] scripts\create-olympus-vault.ps1
[F] scripts\implement-codex-second-brain.ps1
[F] scripts\scaffold-olympus-codex-project.ps1
[F] scripts\update-olympus-vault-sync.ps1
[F] scripts\update-vault-dashboard-cleanup.ps1
[F] scripts\update-vault-interface-refinement.ps1
[F] scripts\update-vault-maintenance-protocol.ps1
[D] src\assets
[D] src\data
[D] src\services
[F] src\App.tsx
[F] src\main.tsx
[F] src\styles.css
[F] src\types.ts
[F] src\vite-env.d.ts
[F] src\assets\Olympus background asset.png
[F] src\data\seed.ts
[F] src\services\launcher.ts
[F] src\services\research.ts
[F] src\services\storage.ts
[F] src\services\tauri.ts
[D] src-tauri\capabilities
[D] src-tauri\src
[F] src-tauri\build.rs
[F] src-tauri\Cargo.toml
[F] src-tauri\schema.sql
[F] src-tauri\tauri.conf.json
[F] src-tauri\capabilities\default.json
[F] src-tauri\src\main.rs
```

### Where key dashboard panels live

At the moment, the main dashboard panels are **not split into separate component files**. They are primarily rendered from:

- `src/App.tsx`

Specifically:
- **Markets panel / strip:** `src/App.tsx`
- **Projects panel:** `src/App.tsx`
- **Weather panel:** `src/App.tsx`
- **Chat panel:** `src/App.tsx`

Supporting files:
- **Seeded panel data:** `src/data/seed.ts`
- **Styling:** `src/styles.css`
- **Types:** `src/types.ts`

## 4. Environment & config

### `.env` / `.env.example`
- I did **not** find a `.env` file
- I did **not** find a `.env.example` file

### Existing API keys
- I did **not** find any configured API keys in the inspected project files
- No obvious secrets were found in:
  - `package.json`
  - `vite.config.ts`
  - `src/`
  - `src-tauri/`

### OS
- This project is being run on **Windows**

Evidence:
- filesystem paths use Windows backslashes, for example:
  - `C:\Users\kevpe\OneDrive\Desktop\Projects\Olympus`
  - `C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault`

## 5. Project paths

### Obsidian vault path
- **Yes, discoverable from code**

Found in:
- `src/data/seed.ts`
- `README.md`

Current path:

```text
C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault
```

### Projects directory path
- **Yes, discoverable from code**

Found in:
- `src/data/seed.ts`

Current path:

```text
C:\Users\kevpe\OneDrive\Desktop\Projects
```

## Notes / uncertainty

- The app includes a Tauri backend, but I did not verify a full desktop runtime launch in this inspection pass.
- The dashboard appears to be **mostly seeded data right now**, with native hooks being scaffolded for future behavior.
- The UI is currently fairly centralized in `src/App.tsx`, so future architecture work may benefit from breaking the dashboard into separate panel components.
