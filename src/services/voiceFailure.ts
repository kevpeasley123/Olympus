/**
 * Plain-language readings of a voice-provider failure (review U2).
 *
 * Audio is an output channel. When it fails, reasoning, text and data are all
 * still fine, so the console says so in one line and keeps the provider's own
 * wording behind a disclosure. None of this reaches the instrument's error
 * state, which is reserved for reasoning and request failures.
 */
export interface VoiceFailureReading {
  /** One line, safe to show at a glance. */
  headline: string;
  /** The original message, for the technical-detail disclosure. */
  detail: string;
  /** A microphone problem rather than an audio-output one. */
  microphone: boolean;
}

const TEXT_STAYS = "Replies stay in text.";

export function describeVoiceFailure(error: string): VoiceFailureReading {
  const detail = error.trim();
  const reading = (headline: string, microphone = false): VoiceFailureReading => ({ headline, detail, microphone });
  if (/insufficient_quota|credit_balance_exhausted|quota|credits are exhausted/i.test(detail)) {
    return reading(`Audio unavailable — OpenAI quota exceeded. ${TEXT_STAYS}`);
  }
  if (/spend_limit|usage_limit|spend limit|usage limit/i.test(detail)) {
    return reading(`Audio unavailable — the OpenAI spend limit is reached. ${TEXT_STAYS}`);
  }
  if (/rate_limit|rate-limited|rate limit|HTTP 429/i.test(detail)) {
    return reading(`Audio unavailable — OpenAI is rate-limiting voice. ${TEXT_STAYS}`);
  }
  if (/OPENAI_API_KEY/.test(detail)) {
    return reading(`Audio unavailable — no OpenAI API key is configured. ${TEXT_STAYS}`);
  }
  if (/HTTP 401|HTTP 403|invalid_api_key/i.test(detail)) {
    return reading(`Audio unavailable — OpenAI refused the API key. ${TEXT_STAYS}`);
  }
  if (/microphone/i.test(detail)) {
    return reading(`Microphone unavailable. ${TEXT_STAYS}`, true);
  }
  if (/timed out/i.test(detail)) {
    return reading(`Audio unavailable — the voice connection timed out. ${TEXT_STAYS}`);
  }
  if (/playback|blocked/i.test(detail)) {
    return reading(`Audio could not play on this device. ${TEXT_STAYS}`);
  }
  if (/desktop app/i.test(detail)) {
    return reading(`Audio plays in the desktop app. ${TEXT_STAYS}`);
  }
  return reading(`Audio unavailable. ${TEXT_STAYS}`);
}
