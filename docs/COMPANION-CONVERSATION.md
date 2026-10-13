# Companion conversation panel

The companion console has explicit Overview and Conversation views within its
existing column. Overview keeps the Mission brief and active mission cards.
Conversation replaces them with a full-height transcript above the pinned
composer. Mission status appears only in Overview; the view switch never grants
approval or executes a mission.

Focusing the composer or starting voice opens Conversation. Outside clicks and
Escape do not dismiss the dedicated reading view. Explicit Overview/Conversation
buttons retain the unsent draft and scroll position. The mounted transcript keeps
message disclosures intact. New responses follow only while the reader is at the
bottom; Latest reply returns there explicitly. Assistant responses use the full
reading width without separate card backgrounds or collapsed previews.

This applies whenever the companion console is expanded. Since 0.30.0
(`ab0b766`) the app mounts the companion console in all four modes, so Project,
Research and Communications get the same views when their conversation dock is
open. A compact console keeps its compact behavior. Column widening is not
introduced. Model selection, voice controls, evidence and approval boundaries are
preserved. The chat memory and observation actions were removed in 0.28.0 and
0.30.0; see `CURATED-MEMORY.md`.

Since 2026-10-13 the desktop app's Conversation view opens on a bar naming the open chat, with
Chats (the list of earlier chats and a search over every saved message), New
chat and Temporary chat. Opening the list replaces the transcript until a chat is
chosen or the list is closed (Escape closes it first). The chat cannot change
while a reply, briefing or voice session is in progress, because the reply
belongs to the chat it was asked in. Deleting a chat says that its Obsidian note
and anything learned from it stay. See `CONVERSATIONS-AND-MEMORY.md`.

Verification: `node scripts/conversation-panel-review.mjs` exercises switching,
draft/scroll retention (including repeated Overview clicks), incoming replies,
keyboard access and non-overlapping geometry at 1440x960, 1920x1080, 1280x800 and
900x900. Its reply events are synthetic and enabled only by the harness's
`conversation-test` parameter. Screenshots are under
`output/conversation-panel-review/`. Full regression is `npm run visual:review`.
Browser verification is not native WebView2 or live-provider acceptance. The
visual review's `chats` and `chats-search` scenarios capture the chat list and a
marked search result over fixture chats.
