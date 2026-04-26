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
}

export function ToolBelt({ tools }: ToolBeltProps) {
  return (
    <div className="tool-column">
      {tools.map((tool) => (
        <ToolRow key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function ToolRow({ tool }: { tool: ToolDefinition }) {
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
      <strong>{tool.name}</strong>
      <span className={areaClass} title={tool.category} aria-hidden="true"></span>
    </div>
  );
}
