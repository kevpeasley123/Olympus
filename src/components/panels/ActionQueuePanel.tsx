import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackedProject } from "../../types";
import { useActionQueue, type ActionQueueTask, type TaskSourceFolder } from "../../hooks/useActionQueue";

const PIN_STORAGE_KEY = "olympus.pinnedAction";
const VISIBLE_TASK_LIMIT = 3;

const TITLE_MAX = 80;
const NOTE_MAX = 200;
const TIMEFRAME_MAX = 30;

interface PinnedAction {
  id: string;
  title: string;
  note?: string;
  timeframe?: string;
  createdAt: string;
}

interface ActionQueuePanelProps {
  projects: TrackedProject[];
  compact?: boolean;
  onExitCompact?: () => void;
}

const SOURCE_LABELS: Record<TaskSourceFolder, string> = {
  Tasks: "TASKS",
  DailyBriefs: "DAILY",
  Projects: "PROJECT"
};

function loadPinnedAction(): PinnedAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.id && parsed.title) {
      return parsed as PinnedAction;
    }
    return null;
  } catch {
    return null;
  }
}

function savePinnedAction(action: PinnedAction | null) {
  if (typeof window === "undefined") return;
  if (action === null) {
    window.localStorage.removeItem(PIN_STORAGE_KEY);
  } else {
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(action));
  }
}

function isMarketsOpen(now: Date): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  return hour >= 9 && hour < 16;
}

function generateAmbientContext(now: Date, projects: TrackedProject[]): string {
  const hour = now.getHours();
  const day = now.toLocaleDateString([], { weekday: "long" });

  let timePhrase: string;
  if (hour < 6) timePhrase = `Late ${day}`;
  else if (hour < 12) timePhrase = `${day} morning`;
  else if (hour < 17) timePhrase = `${day} afternoon`;
  else if (hour < 21) timePhrase = `${day} evening`;
  else timePhrase = `${day} night`;

  const activeCount = projects.filter((p) => p.status === "active").length;
  const projectPhrase =
    activeCount === 0
      ? "quiet docket"
      : activeCount === 1
        ? "1 active project"
        : `${activeCount} active projects`;

  const marketPhrase = isMarketsOpen(now) ? "markets open" : "markets quiet";

  return `${timePhrase} · ${projectPhrase} · ${marketPhrase}`;
}

function formatTodayDate(now: Date): string {
  return now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pin-${Date.now()}`;
}

export function ActionQueuePanel({ projects, compact = false, onExitCompact }: ActionQueuePanelProps) {
  const [now, setNow] = useState(() => new Date());
  const [pinnedAction, setPinnedAction] = useState<PinnedAction | null>(() => loadPinnedAction());
  const [showPinForm, setShowPinForm] = useState(false);
  const { tasks, error } = useActionQueue();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    savePinnedAction(pinnedAction);
  }, [pinnedAction]);

  const ambient = useMemo(() => generateAmbientContext(now, projects), [now, projects]);
  const visibleTasks = useMemo(() => tasks.slice(0, VISIBLE_TASK_LIMIT), [tasks]);

  function handleSubmitPin(action: PinnedAction) {
    setPinnedAction(action);
    setShowPinForm(false);
  }

  function handleClearPin() {
    setPinnedAction(null);
  }

  if (compact) {
    const summary = pinnedAction?.title ?? (tasks[0]?.text ?? ambient);
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
        <span className="action-queue-compact-separator">·</span>
        <span className="action-queue-compact-summary">{summary}</span>
      </section>
    );
  }

  const showFooter = !pinnedAction && tasks.length > 0 && !showPinForm;

  return (
    <section className="dashboard-panel action-queue-panel">
      <header className="action-queue-header">
        <div className="action-queue-eyebrow-group">
          <span className="panel-eyebrow">Action Queue</span>
          <span className="action-queue-date tabular-data">{formatTodayDate(now)}</span>
        </div>
        <span className="action-queue-context">{ambient}</span>
      </header>

      <div className="action-queue-rows">
        {pinnedAction ? <PinnedRow action={pinnedAction} onClear={handleClearPin} /> : null}

        {showPinForm ? (
          <PinForm onSubmit={handleSubmitPin} onCancel={() => setShowPinForm(false)} />
        ) : tasks.length > 0 ? (
          visibleTasks.map((task) => <TaskRow key={task.id} task={task} />)
        ) : (
          <EmptyState onAddPin={() => setShowPinForm(true)} hasError={Boolean(error)} />
        )}
      </div>

      {showFooter ? (
        <footer className="action-queue-footer">
          <button
            type="button"
            className="action-queue-pin-button"
            onClick={() => setShowPinForm(true)}
          >
            + Pin a focus
          </button>
          <span className="action-queue-meta">
            {tasks.length} open · refreshes every 30s
          </span>
        </footer>
      ) : null}
    </section>
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

function PinnedRow({ action, onClear }: { action: PinnedAction; onClear: () => void }) {
  return (
    <div className="action-queue-row action-queue-row--pinned">
      <span className="action-queue-row-label action-queue-row-label--pinned">PINNED</span>
      <div className="action-queue-row-content">
        <div className="action-queue-row-title">{action.title}</div>
        {action.note ? <div className="action-queue-row-note">{action.note}</div> : null}
        {action.timeframe ? (
          <div className="action-queue-row-timeframe tabular-data">{action.timeframe}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="action-queue-row-clear"
        onClick={onClear}
        aria-label="Clear pinned action"
        title="Clear pinned action"
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({ onAddPin, hasError }: { onAddPin: () => void; hasError: boolean }) {
  return (
    <div className="action-queue-empty-state">
      <div className="action-queue-empty-text">
        {hasError ? "Couldn't reach the vault parser." : "No open tasks in the vault."}
      </div>
      <button type="button" className="action-queue-empty-button" onClick={onAddPin}>
        + Pin a focus instead
      </button>
    </div>
  );
}

function PinForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (action: PinnedAction) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const titleValid = title.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!titleValid) return;
    onSubmit({
      id: generateId(),
      title: title.trim(),
      note: note.trim() || undefined,
      timeframe: timeframe.trim() || undefined,
      createdAt: new Date().toISOString()
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form className="action-queue-pin-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="action-queue-pin-field">
        <label className="action-queue-pin-field-label" htmlFor="action-queue-pin-title">
          Title
        </label>
        <input
          id="action-queue-pin-title"
          ref={titleRef}
          className="action-queue-pin-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={TITLE_MAX}
          required
        />
      </div>
      <div className="action-queue-pin-field">
        <label className="action-queue-pin-field-label" htmlFor="action-queue-pin-note">
          Note
        </label>
        <input
          id="action-queue-pin-note"
          className="action-queue-pin-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={NOTE_MAX}
        />
      </div>
      <div className="action-queue-pin-field">
        <label className="action-queue-pin-field-label" htmlFor="action-queue-pin-timeframe">
          Timeframe
        </label>
        <input
          id="action-queue-pin-timeframe"
          className="action-queue-pin-input"
          placeholder="today / this week / by Friday"
          value={timeframe}
          onChange={(event) => setTimeframe(event.target.value)}
          maxLength={TIMEFRAME_MAX}
        />
        <span className="action-queue-pin-field-hint">today / this week / by Friday / etc.</span>
      </div>
      <div className="action-queue-pin-form-actions">
        <button type="button" className="action-queue-pin-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="action-queue-pin-submit" disabled={!titleValid}>
          Pin
        </button>
      </div>
    </form>
  );
}
