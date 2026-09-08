import { createRoot } from "react-dom/client";
import { useLayoutEffect, useState } from "react";
import { ChatPanel } from "./components/panels/ChatPanel";
import { conversationStream } from "./services/conversationStream";
import { emitInstrumentEvent } from "./services/instrumentEvents";
import type { ConversationMessage } from "./types";
import "./styles.css";

const seed: ConversationMessage[] = Array.from({ length: 100 }, (_, i) => ({ id: `fixture-${i}`, role: i % 2 ? "assistant" : "user",
  content: i % 2 ? `### Reply ${i}\n\n` + "This is a fixture response about the current project. ".repeat(18) : `Inspect project ${i}.`, timestamp: "12:00" }));
let begin: () => void, finish: () => void;
function Fixture() {
  const [messages, setMessages] = useState(seed);
  const [pending, setPending] = useState(false);
  useLayoutEffect(() => {
    begin = () => { setPending(true); emitInstrumentEvent("command-received"); };
    finish = () => { const content = conversationStream.current(); setPending(false); setMessages(m => [...m, { id: "fixture-final", role: "assistant", content, timestamp: "12:01" }]); conversationStream.reset(); };
  }, []);
  return <><pre id="results" style={{ position: "fixed", left: 30, top: 30, maxWidth: 700, whiteSpace: "pre-wrap", color: "white" }}>Waiting…</pre>
    <div style={{ position: "fixed", right: 24, bottom: 40, width: 380, height: "calc(100vh - 160px)", display: "flex", alignItems: "flex-end" }}>
      <ChatPanel messages={messages} pending={pending} onSendMessage={text => { setMessages(m => [...m, { id: "fixture-command", role: "user", content: text, timestamp: "12:01" }]); begin(); }}
        onRecordObservation={async () => ({ tone: "success", message: "Fixture only" })} />
    </div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
const wait = (ms = 350) => new Promise(resolve => setTimeout(resolve, ms));
const checks: string[] = [];
function assert(value: unknown, message: string) { if (!value) throw new Error(message); checks.push(message); document.getElementById("results")!.textContent = checks.join("\n"); }
const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const viewport = () => query<HTMLDivElement>(".console-viewport");
const atBottom = () => viewport().scrollHeight - viewport().scrollTop - viewport().clientHeight < 3;
function clickText(text: string) { const button = [...document.querySelectorAll("button")].find(b => b.textContent?.includes(text)); if (!button) throw Error(`Missing control ${text}`); button.click(); }
function type(text: string) { const input = query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text); input.dispatchEvent(new Event("input", { bubbles: true })); }
async function run() {
  await wait(350);
  assert(!document.querySelector(".console-viewport"), "Dormant mode renders no transcript");
  query<HTMLTextAreaElement>(".console-input-row textarea").focus(); await wait(1200);
  assert(query(".command-console").dataset.mode === "engaged" && atBottom(), "Opening live conversation lands at latest");
  assert(document.querySelectorAll("[data-message-id]").length === 6, "Live rendering is bounded to three exchanges");
  type("Keep this unsent draft"); await wait();
  query(".console-input-row textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait();
  assert(query(".command-console").dataset.mode === "dormant" && query<HTMLTextAreaElement>("textarea").value === "Keep this unsent draft", "Escape preserves unsent input");
  query<HTMLTextAreaElement>("textarea").focus(); await wait();
  clickText("Earlier conversation"); await wait();
  assert(query(".command-console").dataset.mode === "transcript", "History is an explicit mode");
  viewport().scrollTop = 100; viewport().dispatchEvent(new Event("scroll")); await wait();
  const top = viewport().getBoundingClientRect().top;
  const anchor = [...viewport().querySelectorAll<HTMLElement>("[data-message-id]")].find(e => e.getBoundingClientRect().bottom > top)!;
  const id = anchor.dataset.messageId, offset = anchor.getBoundingClientRect().top - top;
  clickText("Load earlier"); await wait();
  const restored = [...viewport().querySelectorAll<HTMLElement>("[data-message-id]")].find(e => e.dataset.messageId === id)!;
  assert(Math.abs(restored.getBoundingClientRect().top - viewport().getBoundingClientRect().top - offset) < 3, "Prepending history preserves the visible anchor");
  clickText("Return to latest"); await wait(800);
  assert(query(".command-console").dataset.mode === "engaged" && atBottom(), "Return to latest restores live mode and position");
  type("Stream fixture output"); await wait(); query<HTMLButtonElement>('[aria-label="Send command"]').click(); await wait();
  conversationStream.append("Actual fixture output. ".repeat(150)); emitInstrumentEvent("response-start"); await wait(200);
  assert(atBottom(), "Streaming follows while near the bottom");
  viewport().dispatchEvent(new WheelEvent("wheel", { deltaY: -300, bubbles: true })); viewport().scrollTop -= 300; viewport().dispatchEvent(new Event("scroll")); await wait();
  const heldTop = viewport().scrollTop;
  conversationStream.append(" More arriving text. ".repeat(100)); await wait(200);
  assert(Math.abs(viewport().scrollTop - heldTop) < 3 && Boolean(document.querySelector(".console-latest")), "Reading above bottom is not interrupted by new output");
  clickText("↓ Latest"); await wait(800);
  assert(atBottom(), "Latest resumes bottom following");
  query<HTMLButtonElement>('[aria-label="Minimize console"]').click(); await wait(); finish(); await wait();
  assert(query(".console-status").textContent === "RESPONSE READY", "Dormant status reports an actual completed response");
  query<HTMLTextAreaElement>("textarea").focus(); await wait(1200);
  clickText("Save memory"); await wait();
  assert(Boolean(document.querySelector(".memory-composer")), "Memory promotion remains available");
  clickText("Cancel"); await wait();
  query<HTMLButtonElement>('[aria-label="Record an observation"]').click(); await wait();
  assert(Boolean(document.querySelector("#observation-input")), "Observation composer remains available");
  clickText("Cancel"); await wait();
  clickText("Earlier conversation"); await wait();
  query(".console-input-row textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait();
  assert(query(".command-console").dataset.mode === "engaged", "Escape steps from transcript to live");
  query<HTMLButtonElement>('[aria-label="Minimize console"]').click(); await wait();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })); await wait();
  assert(document.activeElement === query(".console-input-row textarea") && query(".command-console").dataset.mode === "engaged", "Ctrl+K focuses the console");
  assert(query(".console-markdown").textContent!.length > 0, "Completed fixture retains rendered output");
  document.getElementById("results")!.textContent = "PASS\n" + checks.join("\n");
}
if (new URLSearchParams(location.search).has("run")) void run().catch(error => { document.getElementById("results")!.textContent = "FAIL: " + error.message + "\n" + checks.join("\n"); });
