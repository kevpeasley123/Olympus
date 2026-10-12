# Resource intake and constellation plan

## Implemented locally

The Armory now has Add resource and Add skill entry points. Resource intake accepts pasted text or operator-selected Markdown, text and text-bearing PDFs on desktop. Browser preview supports Markdown and text. An explicit Build local outline action selects source passages without making model requests. Review the excerpts, attach reusable guidance, add notes, then save an unevaluated resource to the existing research library. Original source and guidance snapshots remain in the artifact; uploaded desktop originals are retained through the existing attachment path. Existing vault-write approval and Git logging remain authoritative.

Add skill stores named review instructions in SQLite and exposes them in the Armory and resource picker. These are instruction documents, not executable plugin installations. Imported instructions do not receive tool authority. Current limits: 100 custom skills, 160-byte names, 128 KiB (131,072 UTF-8 bytes) instructions; extracted resource text is limited to 180 KB. PDFs requiring OCR and DOCX are not supported. Drafts survive navigation during the app session, not a restart. Browser preview storage is separate from native desktop data. Skill instructions preserve the complete submitted text, including leading/trailing whitespace and line endings; whitespace-only input is rejected. The 128 KiB bound accommodates complete instruction documents such as the 87,253-byte Taste Skill while retaining a finite per-entry limit. The 100-entry cap remains, so a fully populated library holds at most 12.5 MiB of instruction text (plus metadata); browser storage quotas may reject saves before that. No schema migration is required. Larger stored documents remain untrusted, non-executable guidance; this does not add automatic prompt injection, analysis, tools or network calls.

The Plugins cluster derives one keyboard-accessible star per actual plugin adapter. Its count is not hard-coded. Plugins share a cool-blue orbital motion; unavailable adapters are dimmer. Selecting a star opens its actual Armory detail. Motion pauses on hover/focus and obeys reduced-motion settings. Existing decorative stars do not imply installed capabilities.

## Pending explicit approval

Semantic AI digestion is not implemented. Automatic approval review blocked sending arbitrary imported content and skill instructions to the configured OpenAI API without specific user authorization. The local outline is explicitly labeled extractive, not an AI summary or verified claims. Selected skill guidance is saved for review; the local extractor does not interpret it.

If approved, add an explicit Analyze with Sol action showing the selected source and guidance that will be transmitted. Use the existing backend model routing, structured response validation and usage records. Return a summary, source-linked insights, questions and limitations for review before saving. Preserve the source separately and mark generated conclusions unevaluated. Importing alone must never send data.

## Later expansion

After the plugin cluster proves useful, map other Armory types into distinct regions with real counts, availability and accessible inspection. Avoid duplicating every decorative particle as a fake capability. Executable skill packages need a separate installation contract, versioning and explicit capability grants; the current Add skill flow does not install them.

## Verification

Focused local-outline tests and isolated browser intake/skill/constellation checks cover persistence, exact source excerpts, keyboard inspection and draft retention. Rust tests cover skill storage and duplicate/size validation. Browser fixture verification and native desktop inspection are separate acceptance levels; see the current handoff for results.

## Vault constellation

The Obsidian Memory cluster projects the existing bounded vault graph as small violet stars. Each star shows its note title and folder and opens the note through the backend's existing guarded Obsidian handoff. Scaffolding exclusions and the 120-note graph cap still apply; omitted-note counts are shown. Failed refreshes identify an older snapshot instead of claiming a complete current vault.

Hovering or keyboard-focusing one star subtly brightens the whole corresponding collection and shows its links. The same treatment applies to plugins. Neither collection enlarges its visible stars. Dense vaults use smaller invisible targets to keep neighboring notes individually reachable. Since 0.30.0 the vault cluster circles below Omega on a two-minute tilted orbit and stops while hovered or focused, so each note stays selectable; the plugin group's shared motion also pauses on hover/focus.


## Reviewed skill recommendations and one-request approval

The console now offers a local metadata-based suggestion before sending a task that mentions an applicable Taste landing/portfolio use case or daisyUI/Tailwind. Only the reviewed, pinned imported content hashes for Taste v2 and daisyUI 5.7.x are eligible, plus patterns from the three pinned Kinetics documents (see `KINETICS-SKILL-DISCOVERY.md`). Library names or arbitrary prose cannot nominate themselves. This is deterministic matching, not an AI ranking or a general auto-loader; unrelated tasks and absent library entries produce no suggestion.

The dialog shows the task, scope, source version, byte size, hash and requested provider/model. Choose one skill for this request, continue without a skill, or cancel the request. No skill body is included in the recommendation response. Approval sends the complete selected body with the task to the displayed provider; normal chat context remains governed by the existing chat settings. No live provider call is required to recommend or review a skill.

The backend reuses the existing expiring, session-bound, one-use approval proposals and immutable approval/consumption records. Consumption rechecks the exact task, request identity, requested model/provider and stored skill hash before any assistant provider call. Missing, changed, cancelled, expired or replayed proposals fail closed. The full skill is added only as quoted user-level guidance for that one request, never to cached system instructions, conversation history or automatic future prompts. Approval grants no tools, code/dependency changes or deployment authority. Existing Armory inspection still reads full documents locally; this gate governs assistant application, not local file secrecy. Spoken yes/no is not authorization; the operator uses the dialog.

This shipped in 0.25.0. A suggestion appears only once the matching pinned source has been imported in full through Add skill; whether those imports exist in the installed app is not recorded here. The implementation tests perform no import. Codex's separate frontend-skill-advisor follows the same recommendation/ask workflow by instructions; it is advisory, not this runtime gate.
