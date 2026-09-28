import type { ConversationMessage } from "../types";
import { BRIEFING_ID_PREFIX, daySeparators, isBriefing, modelHistory } from "./conversationHistory";
import { routeLabel, routeName } from "./routeLabel";
import { describeVoiceFailure } from "./voiceFailure";

/** Pure checks for the Command console's history, labels and voice readings. */
export function runCommandVoiceHarness() {
  let passed = 0;
  const check = (ok: unknown, label: string) => { if (!ok) throw Error(label); passed++; };
  const message = (id: string, role: ConversationMessage["role"], at?: string, kind?: "briefing"): ConversationMessage =>
    ({ id, role, content: id, timestamp: "12:00", at, kind });

  // Briefings: only the newest reaches the model, the transcript keeps all.
  const history = [
    message(`${BRIEFING_ID_PREFIX}1`, "assistant"),
    message("u1", "user"), message("a1", "assistant"),
    message(`${BRIEFING_ID_PREFIX}2`, "assistant"),
    message("u2", "user"),
    message("b3", "assistant", undefined, "briefing"),
    message("u3", "user")
  ];
  check(isBriefing(history[0]) && isBriefing(history[5]) && !isBriefing(history[2]), "Briefings are recognised by the stored id prefix and by kind");
  const sent = modelHistory(history).map(m => m.id);
  check(JSON.stringify(sent) === JSON.stringify(["u1", "a1", "u2", "b3", "u3"]), "Only the most recent briefing is in model history");
  check(modelHistory([message("u", "user")]).length === 1, "History without a briefing is unchanged");

  // Day separators: first dated message, each day change, undated rows ignored.
  const now = new Date(2026, 8, 28, 12, 0);
  const iso = (d: number, h: number) => new Date(2026, 8, d, h, 0).toISOString();
  const labels = daySeparators([iso(25, 9), iso(25, 10), undefined, iso(27, 9), iso(28, 8), iso(28, 11)], now);
  check(JSON.stringify(labels) === JSON.stringify(["Fri Sep 25", null, null, "Yesterday", "Today", null]), `Day separators ${JSON.stringify(labels)}`);
  check(daySeparators([undefined, undefined], now).every(label => label === null), "Legacy HH:MM rows get no separator");

  // Route labels: human first, identifiers elsewhere.
  check(routeLabel({ capability: "PRIMARY", reasoningEffort: "medium" }) === "Sol · medium", "Sol route label");
  check(routeLabel({ capability: "DEEP_REASONING", reasoningEffort: "high" }) === "Astra · high (one request)", "Astra route label");
  check(routeLabel({ capability: "REALTIME", reasoningEffort: null }) === "Realtime voice", "Realtime label without effort");
  check(routeName(null) === "Model" && routeName("NEW_ROUTE") === "new route", "Unknown routes stay readable");

  // Voice failures read as audio problems with the provider text kept aside.
  const quota = describeVoiceFailure("OpenAI voice session failed (HTTP 429, insufficient_quota). Check the OpenAI API key, project access and billing. Text remains available.");
  check(quota.headline === "Audio unavailable — OpenAI quota exceeded. Replies stay in text." && quota.detail.includes("insufficient_quota"), "Quota failure headline");
  check(describeVoiceFailure("OpenAI rejected the voice connection (HTTP 429). This can mean a rate limit").headline.includes("rate-limiting"), "Bare 429 reads as rate limiting");
  const microphone = describeVoiceFailure("Microphone permission was denied. Allow Olympus microphone access and try again. Text is still available.");
  check(microphone.microphone && microphone.headline.startsWith("Microphone unavailable"), "Microphone failures are named as such");
  check(describeVoiceFailure("Voice needs OPENAI_API_KEY in the Olympus project .env.").headline.includes("no OpenAI API key"), "Missing key");
  check(describeVoiceFailure("Something new").headline === "Audio unavailable. Replies stay in text.", "Unknown failures stay calm and general");
  return { passed };
}
