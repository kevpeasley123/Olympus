/** Only expose known error codes, never raw server bodies or credentials. */
export function voiceHttpError(status: number, body: unknown): string {
  const error = body && typeof body === "object" && "error" in body ? (body as {error: unknown}).error : null;
  const fields = error && typeof error === "object" ? error as {code?: unknown; type?: unknown} : {};
  const code = typeof fields.code === "string" ? fields.code : fields.type;
  const guidance: Record<string, string> = {
    credit_balance_exhausted: "OpenAI API credits are exhausted. Check the API billing balance.",
    insufficient_quota: "OpenAI API quota is unavailable. Check API credits and organization/project limits.",
    organization_usage_limit_exceeded: "The OpenAI organization has reached its API usage limit. Review its Limits page.",
    organization_spend_limit_exceeded: "The OpenAI organization has reached its API spend limit. Review its billing limits.",
    project_spend_limit_exceeded: "This OpenAI project has reached its API spend limit. Review the project's limits.",
    rate_limit_exceeded: "OpenAI temporarily rate-limited voice. Wait before trying again and check Realtime model limits if it persists.",
  };
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(guidance, code)) {
    return `${guidance[code]} (${code}; HTTP ${status}). Text remains available.`;
  }
  if (status === 429) return "OpenAI rejected the voice connection (HTTP 429). This can mean a rate limit or unavailable API quota; check API Billing and Limits. ChatGPT subscriptions do not include API credits. Text remains available.";
  return `Voice connection failed (HTTP ${status}). Text remains available.`;
}
