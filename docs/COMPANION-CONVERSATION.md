# Companion conversation panel

The flagship companion has explicit Overview and Conversation views within its
existing column. Overview keeps the Mission Brief and active mission cards.
Conversation replaces them with a full-height transcript above the pinned
composer. Mission status appears only in Overview; the view switch never grants
approval or executes a mission.

Focusing the composer or starting voice opens Conversation. Outside clicks and
Escape do not dismiss the dedicated reading view. Explicit Overview/Conversation
buttons retain the unsent draft and scroll position. The mounted transcript keeps
message disclosures intact. New responses follow only while the reader is at the
bottom; Latest reply returns there explicitly. Assistant responses use the full
reading width without separate card backgrounds or collapsed previews.

This applies to the flagship expanded companion. Other compact consoles retain
their existing behavior. Column widening is not introduced. Model selection,
voice controls, evidence, memory actions and approval boundaries are preserved.

Verification: `node scripts/conversation-panel-review.mjs` exercises switching,
draft/scroll retention (including repeated Overview clicks), incoming replies,
keyboard access and non-overlapping geometry at 1440x960, 1920x1080, 1280x800 and
900x900. Its reply events are synthetic and enabled only by the harness's
`conversation-test` parameter. Screenshots are under
`output/conversation-panel-review/`. Full regression is `npm run visual:review`.
Browser verification is not native WebView2 or live-provider acceptance.
