# Adaptive project constellation

Command now presents linked vault notes as small luminous stars across the interior
behind Omega. Project tiles, the glyph, readouts, and the outer instrument retain
existing positions. No synthetic stars imply nonexistent files.

`src/services/projectConstellation.ts` reuses the existing ownership/parent graph,
then replaces rigid depth bands with bounded candidate placement across radii 88–143.
Stable note-path seeds and code-point ordering make identical graphs deterministic.
Folder affinity and parent proximity influence placement, but clearance wins. Larger
or more connected notes are slightly brighter/larger; logical depth remains available
in note details rather than being encoded as a rigid radial row.

Each note remains clickable and keyboard accessible. Project hover/focus highlights
its owned stars. The lines still represent actual parent or cross-project links;
no nearest-neighbor connections are invented for appearance. This is a view of linked
vault notes, not a repository file index or a change to folders on disk.

Growth reruns a bounded 80-candidate pass per note at graph refresh, not every frame.
An appended, later-sorting note can land without moving earlier stars. Insertions,
renames, ownership changes, and collision pressure may reposition affected stars;
this is not a persisted coordinate system. The existing backend 120-node cap and
linked-not-shown disclosure remain; unlimited graph scale is not claimed.

Verification: `runProjectConstellationHarness` covers empty/single-note graphs,
one-project distribution in all four quadrants, 64-note/four-project and
112-note/eight-project growth, no lost notes, input-order invariance, node spacing,
real parent links, edge endpoints, and appended-note stability. Existing project-ring,
ambient-motion, Pantheon, and glyph harnesses also pass.
