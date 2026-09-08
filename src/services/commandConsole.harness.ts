import { consoleStepBack, liveConversationStart, nearConversationBottom } from "./commandConsole";
import { conversationStream } from "./conversationStream";
import type { ConversationMessage } from "../types";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
export async function runCommandConsoleHarness() {
  const messages: ConversationMessage[] = Array.from({ length: 100 }, (_, i) => ({ id: String(i), role: i % 2 ? "assistant" : "user", content: "fixture", timestamp: "00:00" }));
  assert(liveConversationStart(messages) === 94, "Expected three recent exchanges");
  assert(liveConversationStart([]) === 0, "Empty history");
  assert(consoleStepBack("transcript") === "engaged" && consoleStepBack("engaged") === "dormant", "Incorrect Escape transition");
  assert(nearConversationBottom(1000, 520, 400) && !nearConversationBottom(1000, 519, 400), "Bottom threshold is not 80px");
  conversationStream.reset(); conversationStream.append("first "); conversationStream.append("second");
  assert(conversationStream.current() === "first second", "Deltas lost or reordered before batch flush");
  conversationStream.reset(); await new Promise(resolve => setTimeout(resolve, 60));
  assert(conversationStream.current() === "", "Old batch survived reset");
  return { passed: true, recentExchanges: 3, bottomThreshold: 80, streamOrderPreserved: true };
}
