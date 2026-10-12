# Project conversation dock

Project mode gives its workspace the available width until the operator opens Olympus. The bottom dock opens the existing conversation; Back to projects returns the space without unmounting the chat or Projects. Search, project selection, scroll state, conversation and drafts remain owned by their existing components.

At desktop widths the conversation occupies a 380 px column. Below 1100 px it becomes a drawer over the workspace instead of compressing project cards. Activation is explicit through the dock, the existing console shortcut, assessment handoff, or a new voice session. Background replies do not open it. A deliberately minimized conversation shows Working, Reply ready, Voice active or Needs attention as applicable.

The animation adapts the installed Kinetics Card Resize pattern into a short CSS grid transition, without measurement loops or added dependencies. Reduced motion changes layout immediately. The dock and return action are keyboard accessible; return restores focus to the dock.

Verification is recorded in output/project-linking/dock-*.log and screenshots in output/project-dock. Browser scenarios cover width recovery, deliberate activation, outside clicks, draft retention, focus restoration, attached project context, narrow drawer containment and reduced motion. Shared chat/project contracts and the full visual regression cover existing behavior. Native WebView2 and actual voice/provider operations require separate acceptance.

Verified: production build; focused dock browser workflow at 1440, 1280, 980 and 640 px; 17 attached-context, 3 membership/request, 50 board and 31 delegation-review checks; full visual regression 21/21 scenarios, 57 functional checks and 22 Organizer browser checks. Screenshots inspected for wide workspace, open conversation and narrow drawer. Initial fixture selector and startup issues were corrected; the off-screen narrow drawer was reproduced and fixed before the final passing run.
