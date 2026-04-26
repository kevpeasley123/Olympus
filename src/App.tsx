import {
  ChevronDown,
  ChevronRight,
  Compass,
  FilePlus2,
  FileSearch,
  ImagePlus,
  RefreshCw,
  Settings2,
  Video,
  Workflow
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createResearchRecordFromText } from "./services/research";
import { addResearchRecord, loadState, resetState, saveState } from "./services/storage";
import type {
  ConversationMessage,
  MarketIndex,
  MarketNewsItem,
  MarketRate,
  OlympusState,
  ResearchRecord,
  ToolDefinition,
  TrackedProject
} from "./types";

const toolIcons: Record<string, typeof ImagePlus> = {
  "tool-image-to-video": ImagePlus,
  "tool-youtube-transcript": Video,
  "tool-article-summarizer": FileSearch,
  "tool-project-scaffold": Workflow
};

function App() {
  const [state, setState] = useState<OlympusState>(() => loadState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [marketExpanded, setMarketExpanded] = useState(false);
  const [researchTitle, setResearchTitle] = useState("");
  const [researchText, setResearchText] = useState("");
  const [researchSourceType, setResearchSourceType] =
    useState<ResearchRecord["sourceType"]>("article");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function setStateAndSave(next: OlympusState) {
    setState(next);
  }

  function handleReset() {
    setStateAndSave(resetState());
    setComposerOpen(false);
    setResearchTitle("");
    setResearchText("");
    setResearchSourceType("article");
  }

  function handleResearchSubmit() {
    if (!researchText.trim()) return;

    const record = createResearchRecordFromText(
      researchTitle,
      researchText,
      researchSourceType
    );

    setStateAndSave(addResearchRecord(state, record));
    setResearchTitle("");
    setResearchText("");
    setResearchSourceType("article");
    setComposerOpen(false);
  }

  function handleVaultPathChange(vaultPath: string) {
    setStateAndSave({
      ...state,
      settings: {
        ...state.settings,
        vaultPath
      }
    });
  }

  const timeLabel = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const dateLabel = now.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });

  const visibleTools = state.tools.filter((tool) => tool.id !== "tool-prompt-builder");
  const marketMetrics = useMemo(
    () => [...state.market.indexes, ...state.market.rates],
    [state.market.indexes, state.market.rates]
  );
  const researchEntryLabel = `${state.research.length} ${state.research.length === 1 ? "entry" : "entries"}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Command Station</p>
          <h1>Olympus</h1>
        </div>

        <div className="topbar-actions">
          <div className="header-pill tabular-data">
            <span>{timeLabel}</span>
            <span className="header-separator">·</span>
            <span>{dateLabel}</span>
          </div>
          <button className="icon-button" onClick={handleReset} title="Reset dashboard data">
            <RefreshCw size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setSettingsOpen((value) => !value)}
            title="Open settings"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Settings</p>
              <h2>Workspace</h2>
            </div>
          </div>
          <label className="field-block">
            <span>Obsidian vault path</span>
            <input
              value={state.settings.vaultPath}
              onChange={(event) => handleVaultPathChange(event.target.value)}
              placeholder="Vault path"
            />
          </label>
          <label className="field-block">
            <span>Projects root path</span>
            <input value={state.settings.projectsRootPath} readOnly />
          </label>
        </section>
      )}

      <section className="main-grid">
        <aside className="tools-rail panel-shell">
          <div className="strip-header compact">
            <div>
              <p className="eyebrow">Tools</p>
            </div>
          </div>
          <div className="tool-column">
            {visibleTools.map((tool) => (
              <ToolRow key={tool.id} tool={tool} />
            ))}
          </div>
        </aside>

        <section className="center-stack">
          <section className="dashboard-panel market-panel">
            <div className="market-strip-top">
              <div className="market-strip-title">
                <p className="eyebrow">Markets</p>
              </div>
              <div className="market-strip-actions">
                <div className="panel-meta tabular-data">Updated {timeLabel}</div>
                <button
                  className="market-toggle"
                  onClick={() => setMarketExpanded((value) => !value)}
                  title={marketExpanded ? "Collapse market detail" : "Expand market detail"}
                >
                  <ChevronDown size={16} className={marketExpanded ? "is-expanded" : ""} />
                </button>
              </div>
            </div>
            <div className="market-strip-grid">
              {marketMetrics.map((item) => (
                <MarketStripMetric key={item.id} item={item} />
              ))}
            </div>
            <div className={marketExpanded ? "market-detail is-expanded" : "market-detail"}>
              <div className="market-news-section">
                <p className="subhead">News</p>
                <div className="market-news-list">
                  {state.market.news.map((item) => (
                    <MarketNewsRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-panel projects-panel">
            <div className="projects-panel-top">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Projects</p>
                  <h2>Tracked Work</h2>
                </div>
              </div>
              <p className="section-copy projects-copy">
                This should become the bridge between your project folders, Git activity, and
                Obsidian memory.
              </p>
            </div>
            <div className="project-list">
              {state.projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>

          <section className="dashboard-panel research-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Research Database</p>
                <h2>Library</h2>
                <p className="section-copy research-count">{researchEntryLabel}</p>
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
              Add new sources here, then open the full database when you want to review or manage
              saved material.
            </p>

            {composerOpen && (
              <div className="research-composer">
                <div className="composer-grid">
                  <input
                    value={researchTitle}
                    onChange={(event) => setResearchTitle(event.target.value)}
                    placeholder="Research title"
                  />
                  <select
                    value={researchSourceType}
                    onChange={(event) =>
                      setResearchSourceType(event.target.value as ResearchRecord["sourceType"])
                    }
                  >
                    <option value="article">Article</option>
                    <option value="transcript">Transcript</option>
                    <option value="note">Note</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <textarea
                  value={researchText}
                  onChange={(event) => setResearchText(event.target.value)}
                  placeholder="Paste article text, transcript text, or notes"
                />
                <button className="primary-action" onClick={handleResearchSubmit}>
                  Save to Library
                </button>
              </div>
            )}

          </section>
        </section>

        <section className="right-stack">
          <section className="dashboard-panel weather-panel">
            <div className="weather-strip">
              <p className="eyebrow">Weather</p>
              <div className="weather-inline">
                <span className="weather-location">{state.weather.label}</span>
                <span className="weather-separator">&middot;</span>
                <span className="weather-temp tabular-data">{state.weather.temperature}</span>
                <span className="weather-separator">&middot;</span>
                <span>{state.weather.condition}</span>
                <span className="weather-separator">&middot;</span>
                <span className="tabular-data">{state.weather.humidity} RH</span>
                <span className="weather-separator">&middot;</span>
                <span className="tabular-data">{state.weather.wind}</span>
              </div>
            </div>
          </section>

          <section className="dashboard-panel conversation-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h2>Chat</h2>
              </div>
              <Compass size={18} className="panel-icon" />
            </div>
            <div className="conversation-thread">
              {state.conversation.map((message) => (
                <ConversationBubble key={message.id} message={message} />
              ))}
            </div>
            <div className="conversation-input-shell">
              <input placeholder="Type a message..." disabled />
              <button className="send-button" disabled>
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function MarketStripMetric({ item }: { item: MarketIndex | MarketRate }) {
  return (
    <div className="market-strip-metric">
      <span className="market-strip-label">{item.label}</span>
      <span className="market-strip-value tabular-data">{item.value}</span>
      <span className={`market-strip-delta ${item.direction} tabular-data`}>{item.change}</span>
    </div>
  );
}

function ConversationBubble({ message }: { message: ConversationMessage }) {
  return (
    <article className={`conversation-bubble ${message.role}`}>
      <p>{message.content}</p>
      <small className="tabular-data">{message.timestamp}</small>
    </article>
  );
}

function MarketNewsRow({ item }: { item: MarketNewsItem }) {
  return (
    <article className="market-news-row">
      <div className="market-news-head">
        <strong>{item.headline}</strong>
        <small>{item.source}</small>
      </div>
      <p className="dense-text">{item.summary}</p>
    </article>
  );
}

function ProjectCard({ project }: { project: TrackedProject }) {
  const statusLabel = project.status.toUpperCase();
  const latestSignalEmpty = /no commits yet/i.test(project.lastCommit);

  return (
    <article className="project-card">
      <div className="project-card-header">
        <strong>{project.name}</strong>
        <span className={`project-state ${project.status}`}>{statusLabel}</span>
      </div>
      <div className="project-meta-line project-path" title={project.path}>
        <span>{project.path}</span>
        <span className="project-meta-dot" aria-hidden="true">&middot;</span>
        <span className="tabular-data">{project.branch}</span>
        <span className="project-meta-dot" aria-hidden="true">&middot;</span>
        <span>{project.repoState}</span>
      </div>
      <div
        className={
          latestSignalEmpty ? "project-signal-line is-empty" : "project-signal-line tabular-data"
        }
        title={project.lastCommit}
      >
        <span aria-hidden="true">↳</span>
        <span>{project.lastCommit}</span>
      </div>
      <div className="project-next-line" title={project.nextStep}>
        <span aria-hidden="true">→</span>
        <span>{project.nextStep}</span>
      </div>
    </article>
  );
}

function ToolRow({ tool }: { tool: ToolDefinition }) {
  const Icon = toolIcons[tool.id];
  const areaClass = `tool-area-dot ${tool.category.toLowerCase()}`;

  return (
    <div className="tool-row">
      <div className="tool-row-main">
        <span className="tool-row-icon" title={tool.category}>
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <strong>{tool.name}</strong>
        <span className={areaClass} title={tool.category} aria-hidden="true"></span>
      </div>
      <button className="tool-action tool-launch-button" title={`Launch ${tool.name}`}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default App;
