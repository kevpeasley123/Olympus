import { FileSearch, ImagePlus, Video, Workflow } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { ToolDefinition } from "../../types";

const toolIcons: Record<string, typeof ImagePlus> = {
  "tool-image-to-video": ImagePlus,
  "tool-youtube-transcript": Video,
  "tool-article-summarizer": FileSearch,
  "tool-project-scaffold": Workflow
};

interface ToolBeltProps {
  tools: ToolDefinition[];
  compact?: boolean;
}

export function ToolBelt({ tools, compact = false }: ToolBeltProps) {
  return (
    <div className={`tool-column ${compact ? "is-compact" : ""}`}>
      {tools.map((tool) => (
        <ToolRow key={tool.id} tool={tool} compact={compact} />
      ))}
    </div>
  );
}

function ToolRow({ tool, compact }: { tool: ToolDefinition; compact: boolean }) {
  const Icon = toolIcons[tool.id];
  const areaClass = `tool-area-dot ${tool.category.toLowerCase()}`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
  }

  return (
    <div
      className="tool-row"
      role="button"
      tabIndex={0}
      aria-label={`Launch ${tool.name}`}
      onKeyDown={handleKeyDown}
      title={`Launch ${tool.name}`}
    >
      <span className="tool-row-icon" title={tool.category}>
        <Icon size={16} strokeWidth={1.8} />
      </span>
      {!compact ? <strong>{tool.name}</strong> : null}
      <span className={areaClass} title={tool.category} aria-hidden="true"></span>
    </div>
  );
}
