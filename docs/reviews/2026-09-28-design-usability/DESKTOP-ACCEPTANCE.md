# Desktop acceptance — design-review implementation

2026-09-29. For branch `claude/blissful-lamport-2l4o96` at `cc0f182` or later.

Everything here has passed build, unit tests and browser checks against a synthetic IPC mock. None of it has been run in the desktop app. This list is for that run.

Each check is grouped by what it needs. **Nothing in groups C–E should be run without the operator deciding to.**

## Before starting (safe setup)

The desktop app always uses the real vault path (`VAULT_PATH`, hardcoded) and `olympus.sqlite` in the app data directory. There is no fixture-vault switch. Adding an `OLYMPUS_VAULT_PATH` override would be a code change; it was not made.

The safest setup available:

1. **Close Olympus.** Copy `%APPDATA%\com.projectolympus.commandstation\olympus.sqlite` (and any `-wal` / `-shm` files) somewhere safe.
2. **Remove the provider keys for groups A and B.** Rename `.env`, or blank `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, so no request can be paid for. Chat and voice will then fail honestly, which several checks rely on.
3. **Pause Gmail background analysis** in Preferences, or leave Gmail disconnected.
4. **Start the dev build.** Check out the branch and run `npm ci` then `npm run tauri dev`. This does not install anything.
5. **Treat the write gate as a guard.** When it appears, choose **Keep**, unless a check says otherwise.

## A. Safe: no provider calls, no data changes

| # | Check | Expected |
| --- | --- | --- |
| A1 | Launch | No example projects anywhere, including before the first scan finishes. The ring reads SCANNING… and then shows your real projects. |
| A2 | Temporarily rename the projects root folder (Preferences cannot edit the stored path) | Either a scan failure (ring: SCAN FAILED with Retry; board: a failure banner and no rows) or, if the scan treats a missing root as empty, NO PROJECTS naming the path. Either way the ring, board, header and briefing agree. Which of the two happens has not been confirmed. Restore the folder afterwards and press Retry. |
| A3 | With no provider key, send a typed message in Voice mode | Chat error shown. Instrument turns red, since this is a request failure. The voice row does not claim that audio played. |
| A4 | Text mode after launch | Console shows BRIEFING READY with a one-line preview. Opening the console clears it, and the bubble is labelled "Opening briefing · from project state, no model". |
| A5 | Tab from the page start in each mode | The first stop is a visible "Skip to console". Enter focuses the console input. |
| A6 | Preferences | Focus moves inside it and Tab stays inside it. Escape closes it and focus returns to the gear. Ctrl+\ does nothing while it is open. |
| A7 | Ctrl+R, including while typing in the console | The window never reloads, the draft remains, and data refreshes. |
| A8 | Mode switching with work in progress | Leave work open in each mode: a review note, a run draft, a library search with an entry open, an Add Entry draft, a selected situation. Cycle through all four modes. Everything is restored, and closing a changed draft asks first. |
| A9 | Research | Library, Questions and Audits segments. Opening an entry and going back restores the list position. `/` focuses search only when you are not typing in a field. |
| A10 | Links in a research entry | They open in the system browser, and Olympus does not navigate away. |
| A11 | Restart from Preferences | A confirmation lists live work. Cancel leaves everything running. Confirm restarts the app. |
| A12 | Rendering | The 3D instrument appears, and the flat 2D ring shows immediately before it. Launch in Research mode: the 3D scene starts only on the first Command visit. |
| A13 | Windows presentation | No console windows flash during the 60-second project scan. Text sizes and control rows are acceptable at your normal window size. |
| A14 | Gmail disconnected | Communications header shows "Disconnected" with Connect, and no stale "Connected". |

## B. Reads real data, no writes

These need your normal data but no API keys.

| # | Check | Expected |
| --- | --- | --- |
| B1 | Transcript dates | Older conversation shows day separators. Rows imported from localStorage carry their import date (a known limit). |
| B2 | Project board | ATTENTION observations match reality (dirty checkout, vision review age). They never change a project's status. |
| B3 | Delegation run in `waiting` | "Read the plan" shows the plan without starting an approval timer. |
| B4 | Delegation run in `awaiting_review` | Type review notes, run a check, confirm the notes survive. The completion checklist names what is missing. Do not press Complete unless you intend to. |
| B5 | Research entry cited in an old reply | "Open in library" shows Unchanged or Changed correctly. Edit the note's body in Obsidian and confirm it changes to Changed. |
| B6 | Communications with existing situations | At your window size the next step is visible on arrival and no map text is smaller than 12px. Review source shows the recommendation, the quote and the thread. |

## C. Changes local data (approve only if intended)

| # | Check | Notes |
| --- | --- | --- |
| C1 | Add a research entry with an accented title and an attachment | The write gate appears. Approve it, then confirm the entry commits without a "(2)" copy. Decline once first to see that retry reuses the attachment. |
| C2 | Append a profile observation to a note containing accented text | Needs approval. The note must keep all its earlier content. |
| C3 | Gmail cache removal | Deletes cached mail and derived situations. **Irreversible.** Check the counts dialog, then press **Keep cache** unless you really want the removal. |
| C4 | Narrowing the Gmail history range | Prunes older cached mail on the next sync. Check the confirmation, then cancel. |

## D. Real provider calls (paid; need restored keys)

| # | Check | Notes |
| --- | --- | --- |
| D1 | Typed message with Voice on (Sol) | Written text should start streaming before the spoken summary finishes (U6). Measure the time to first visible text. |
| D2 | The same on the Claude route | This order depends only on the prompt example; record what happens. |
| D3 | Voice quota or 429 behaviour | If credit is still exhausted: the instrument stays idle, the voice row offers Retry audio, Switch replies to Text and Dismiss, and the briefing is not replayed. |
| D4 | Opening briefing audio | Plays once under WebView2's autoplay policy. |
| D5 | Ask Olympus about a Gmail thread | Your bubble shows an attachment chip, not the raw reference. The answer is grounded in the thread. A follow-up question still has the context. |
| D6 | Gmail with a real account | Sync, the error states (auth, sync, understanding, backoff with real retry times) and the removal counts. Disconnect revokes on a best-effort basis. |

## E. Delegation execution (paid; runs code)

| # | Check | Notes |
| --- | --- | --- |
| E1 | Prepare a planning run on a throwaway project | The approval shows permitted actions in words, the base as branch @ hash only when HEAD is that commit, and a countdown. |
| E2 | Stop run | Asks for confirmation. The `claude.exe` process ends, and nothing remains running after Olympus exits (Job Object). |

## Known pre-existing environment failure

`hybrid-core-harness` "Voice signature follows changing speech energy" fails in the cloud container on the original 0.19.0 (`e4669c9`), the design-review baseline (`d47f95f`) and the final code (`056e91f`): 5 of 5 runs failed on the baseline, 5 of 5 on the final code, and 3 of 3 on 0.19.0. SwiftShader renders about one frame every three seconds there. The check is not evidence either way. Run it in a desktop browser with a GPU:

```bash
npm run dev
```

Then open `/hybrid-core-harness.html?run`.
