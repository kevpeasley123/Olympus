# Project conversation dock

Added in 0.29.0 for Project mode; since 0.30.0 (`ab0b766`) Research and Communications use the same dock and console presentation. These modes give the workspace the available width until the operator opens Olympus. The bottom dock (**Ask Olympus…**) opens the existing conversation; the console's collapse action (**Back to projects** in Project mode, **Close console** in Research and Communications) returns the space without unmounting the chat or the workspace. Search, project selection, scroll state, conversation and drafts remain owned by their existing components.

At desktop widths the conversation occupies a 380 px column. Below 1100 px it becomes a drawer over the workspace instead of compressing the workspace. Activation is explicit through the dock, the existing console shortcut, assessment handoff, or a new voice session. Background replies do not open it. While closed, the dock shows Working…, Voice active, Needs attention, Reply ready or Open conversation as applicable.

The animation adapts the installed Kinetics Card Resize pattern into a short CSS grid transition, without measurement loops or added dependencies. Reduced motion changes layout immediately. The dock and return action are keyboard accessible; return restores focus to the dock.

Verification: `node scripts/test-project-dock.mjs` (width recovery, deliberate activation, outside clicks, draft retention, focus restoration, attached project context, narrow drawer containment and reduced motion) and `node scripts/test-shared-chat.mjs`, plus the full visual regression. Native WebView2 and actual voice/provider operations are not accepted in the desktop app.
