import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import type { ResearchRecord } from "../../types";

interface LibraryPanelProps {
  entryCount: number;
  onAddResearch: (title: string, text: string, sourceType: ResearchRecord["sourceType"]) => void;
}

export function LibraryPanel({ entryCount, onAddResearch }: LibraryPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState<ResearchRecord["sourceType"]>("article");
  const entryLabel = `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`;

  function handleSubmit() {
    onAddResearch(title, text, sourceType);
    if (!text.trim()) return;
    setTitle("");
    setText("");
    setSourceType("article");
    setComposerOpen(false);
  }

  return (
    <section className="dashboard-panel research-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Research Database</p>
          <h2>Library</h2>
          <p className="section-copy research-count">{entryLabel}</p>
        </div>
        <div className="panel-actions">
          <button className="ghost-action">View Database</button>
          <button
            className={composerOpen ? "ghost-action is-active" : "ghost-action"}
            onClick={() => setComposerOpen((value) => !value)}
          >
            <FilePlus2 size={15} />
            {composerOpen ? "Close Inbox" : "Add Research"}
          </button>
        </div>
      </div>
      <p className="section-copy">
        Add new sources here, then open the full database when you want to review or manage saved
        material.
      </p>

      {composerOpen && (
        <div className="research-composer">
          <div className="composer-grid">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Research title"
            />
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as ResearchRecord["sourceType"])}
            >
              <option value="article">Article</option>
              <option value="transcript">Transcript</option>
              <option value="note">Note</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste article text, transcript text, or notes"
          />
          <button className="primary-action" onClick={handleSubmit}>
            Save to Library
          </button>
        </div>
      )}
    </section>
  );
}
