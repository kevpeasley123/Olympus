import { FileSearch, ImagePlus, Video, Workflow } from "lucide-react";
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

  // No launch is wired yet, so the row is not a control: a focusable
  // role="button" that does nothing is worse than a plain label.
  return (
    <div className="tool-row" title={tool.name}>
      <span className="tool-row-icon" title={tool.category} role="img" aria-label={tool.name}>
        <Icon size={16} strokeWidth={1.8} />
      </span>
      {!compact ? <strong>{tool.name}</strong> : null}
      <span className={areaClass} title={tool.category} aria-hidden="true"></span>
    </div>
  );
}
