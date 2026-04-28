import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActionQueue, type ActionQueueTask, type TaskSourceFolder } from "../../hooks/useActionQueue";

const VISIBLE_TASK_LIMIT = 3;

interface ActionQueuePanelProps {
  compact?: boolean;
  onExitCompact?: () => void;
}

const SOURCE_LABELS: Record<TaskSourceFolder, string> = {
  Tasks: "TASKS",
  DailyBriefs: "DAILY",
  Projects: "PROJECT"
};

function formatTodayDate(now: Date): string {
  return now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function ActionQueuePanel({ compact = false, onExitCompact }: ActionQueuePanelProps) {
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const { tasks, error } = useActionQueue();
  const panelRef = useRef<HTMLElement>(null);
  const [overlayRect, setOverlayRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const handleEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !panelRef.current) {
      setOverlayRect(null);
      return;
    }

    const updateRect = () => {
      const node = panelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setOverlayRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [expanded]);

  const visibleTasks = tasks.slice(0, VISIBLE_TASK_LIMIT);
  const hasTasks = tasks.length > 0;

  if (compact) {
    const summary = tasks[0]?.text;
    return (
      <section
        className="dashboard-panel action-queue-panel action-queue-panel--compact"
        onClick={onExitCompact}
        role="button"
        tabIndex={0}
        title="Exit Project Mode"
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && onExitCompact) {
            event.preventDefault();
            onExitCompact();
          }
        }}
      >
        <span className="panel-eyebrow">Action Queue</span>
        {summary ? (
          <>
            <span className="action-queue-compact-separator">·</span>
            <span className="action-queue-compact-summary">{summary}</span>
          </>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section ref={panelRef} className="dashboard-panel action-queue-panel">
        <header className="action-queue-header">
          <div className="action-queue-eyebrow-group">
            <span className="panel-eyebrow">Action Queue</span>
            <span className="action-queue-date tabular-data">{formatTodayDate(now)}</span>
          </div>
        </header>

        <div className="action-queue-rows">
          {hasTasks ? (
            visibleTasks.map((task) => <TaskRow key={task.id} task={task} />)
          ) : (
            <EmptyState hasError={Boolean(error)} />
          )}
        </div>

        {hasTasks ? (
          <footer className="action-queue-footer">
            <button
              type="button"
              className="action-queue-footer-toggle"
              onClick={() => setExpanded((value) => !value)}
              title={expanded ? "Hide all tasks" : "Show all tasks"}
            >
              <span>{expanded ? "Hide" : "Show all"}</span>
              <ChevronDown size={14} className={expanded ? "is-expanded" : ""} />
            </button>
          </footer>
        ) : null}
      </section>

      {expanded && overlayRect
        ? createPortal(
            <div
              className="action-queue-overlay"
              role="dialog"
              aria-label="All open tasks"
              style={{
                top: overlayRect.top,
                left: overlayRect.left,
                width: overlayRect.width
              }}
            >
              <div className="action-queue-overlay-header">
                <span className="action-queue-overlay-title">All open tasks</span>
                <button
                  type="button"
                  className="action-queue-overlay-close"
                  onClick={() => setExpanded(false)}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="action-queue-overlay-list">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function TaskRow({ task }: { task: ActionQueueTask }) {
  const sourceLabel = SOURCE_LABELS[task.sourceFolder];
  return (
    <div
      className="action-queue-row"
      data-source={task.sourceFolder}
      title={`${task.text}\n${task.sourceFile}:${task.lineNumber}`}
    >
      <span className="action-queue-row-label">{sourceLabel}</span>
      <div className="action-queue-row-content">
        <div className="action-queue-row-title">{task.text}</div>
        <div className="action-queue-row-source">{task.sourceFile}</div>
      </div>
    </div>
  );
}

function EmptyState({ hasError }: { hasError: boolean }) {
  return (
    <div className="action-queue-empty-state">
      <div className="action-queue-empty-text">
        {hasError ? "Couldn't reach the vault parser." : "No open tasks in the vault."}
      </div>
    </div>
  );
}
