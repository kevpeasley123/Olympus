# Import from X

Research > Add research > **Import from X** turns an X article or post into a
research entry, with its text, images, code boxes and links intact, and a
classification by Claude. Added in 0.72.0.

## Flow

1. Kevin pastes a post link (`x.com/<name>/status/<number>`; twitter.com,
   mobile and fx spellings work). An `x.com/i/article/...` link is refused with
   a request for the post that shares it.
2. `x_import_preview` (`src-tauri/src/commands/x_import.rs`) reads the public
   FxTwitter API (`api.fxtwitter.com`). X itself serves articles only to a
   signed-in browser. The post's address is the only thing sent there.
3. The article's Draft.js blocks become Markdown: paragraphs with bold, italic,
   inline code and links (offsets are UTF-16), headings, quotes, bulleted and
   numbered lists, code blocks; atomic blocks become images, code boxes (the
   `MARKDOWN` entity, kept verbatim), dividers and embedded-post links. The
   cover comes first. A plain post keeps its text and photos. Images come only
   from `pbs.twimg.com/media`; at most 12 per piece. Links other than http(s)
   keep their text only.
4. Up to eight images, at X's small size, go to Claude on Kevin's subscription
   with the text (`claude_subscription::with_images`: image blocks ahead of the
   text in the same user message). Claude answers with a kind (course, guide,
   research paper, paper summary, essay, case study, announcement, reference,
   thread, other), a two or three sentence summary, up to six topics, the
   audience and one line per image. The piece is untrusted data in the prompt.
   An unknown kind becomes `other`; a failed evaluation leaves the piece
   unclassified and still saveable.
5. The preview shows all of that. Nothing is written until **Save to research**.
6. `x_import_save` downloads each image at the large size into
   `02 - Research/_attachments/x-<handle>-<id>-<n>.<ext>` (never overwriting,
   one vault commit each), then writes the entry through the research writer:
   `source_type` `x-article` or `x-post`, the post URL and date, tags
   `olympus/x-import`, `research/kind/<kind>` and `topic/<topic>`, the image
   attachments, and Kevin's optional "why keep it". The body opens with the
   author line, the classification and which model made it, then the article
   with each image embedded and described.

Previews live in memory for the running app; an expired token asks for the
link again.

## Never run against real data

The FxTwitter shape was read from one real article on 2026-11-14 (blocks,
entity map with `MEDIA`, `MARKDOWN`, `LINK`, `DIVIDER`, `media_entities`). The
end-to-end import, image downloads and Claude's image reading have not run on
Kevin's PC.
