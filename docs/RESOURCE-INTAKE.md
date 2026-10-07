# Resource intake and constellation plan

## Implemented locally

The Armory now has Add resource and Add skill entry points. Resource intake accepts pasted text or operator-selected Markdown, text and text-bearing PDFs on desktop. Browser preview supports Markdown and text. An explicit Build local outline action selects source passages without making model requests. Review the excerpts, attach reusable guidance, add notes, then save an unevaluated resource to the existing research library. Original source and guidance snapshots remain in the artifact; uploaded desktop originals are retained through the existing attachment path. Existing vault-write approval and Git logging remain authoritative.

Add skill stores named review instructions in SQLite and exposes them in the Armory and resource picker. These are instruction documents, not executable plugin installations. Imported instructions do not receive tool authority. Current limits: 100 custom skills, 160-byte names, 20 KB instructions; extracted resource text is limited to 180 KB. PDFs requiring OCR and DOCX are not supported. Drafts survive navigation during the app session, not a restart. Browser preview storage is separate from native desktop data.

The upper-left plugin cluster derives one keyboard-accessible star per actual plugin adapter. Its count is not hard-coded. Plugins share a cool-blue orbital motion; unavailable adapters are dimmer. Selecting a star opens its actual Armory detail. Motion pauses on hover/focus and obeys reduced-motion settings. Existing decorative stars do not imply installed capabilities.

## Pending explicit approval

Semantic AI digestion is not implemented. Automatic approval review blocked sending arbitrary imported content and skill instructions to the configured OpenAI API without specific user authorization. The local outline is explicitly labeled extractive, not an AI summary or verified claims. Selected skill guidance is saved for review; the local extractor does not interpret it.

If approved, add an explicit Analyze with Sol action showing the selected source and guidance that will be transmitted. Use the existing backend model routing, structured response validation and usage records. Return a summary, source-linked insights, questions and limitations for review before saving. Preserve the source separately and mark generated conclusions unevaluated. Importing alone must never send data.

## Later expansion

After the plugin cluster proves useful, map other Armory types into distinct regions with real counts, availability and accessible inspection. Avoid duplicating every decorative particle as a fake capability. Executable skill packages need a separate installation contract, versioning and explicit capability grants; the current Add skill flow does not install them.

## Verification

Focused local-outline tests and isolated browser intake/skill/constellation checks cover persistence, exact source excerpts, keyboard inspection and draft retention. Rust tests cover skill storage and duplicate/size validation. Browser fixture verification and native desktop inspection are separate acceptance levels; see the current handoff for results.

## Vault constellation

The southern field now projects the existing bounded vault graph as small violet stars. Each star shows its note title and folder and opens the note through the backend's existing guarded Obsidian handoff. Scaffolding exclusions and the 120-note graph cap still apply; omitted-note counts are shown. Failed refreshes identify an older snapshot instead of claiming a complete current vault.

Hovering or keyboard-focusing one star subtly brightens the whole corresponding collection. The same treatment applies to plugins. Neither collection enlarges its visible stars. Dense vaults use smaller invisible targets to keep neighboring notes individually reachable. The vault field is stationary for precise selection; the plugin group's existing shared motion pauses on hover/focus.
