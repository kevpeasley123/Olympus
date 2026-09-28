/**
 * Reply recipients as the operator typed them (review U3).
 *
 * The field keeps the text verbatim — display names, capitals, spacing — and is
 * parsed only when the operator leaves it or saves. Saving sends the addresses
 * alone, in the form the backend validates: the characters its participant
 * parser accepts, lower-cased.
 */

export interface ParsedRecipients {
  /** Unique, lower-cased addresses in the order typed. */
  emails: string[];
  /** Entries that contain no usable address, verbatim. */
  invalid: string[];
}

const ADDRESS = /[A-Za-z0-9._+-]+@[A-Za-z0-9._+-]+/g;

function usable(address: string): boolean {
  const [local, domain] = address.split("@");
  return Boolean(local) && Boolean(domain) && domain.includes(".") && !domain.endsWith(".") && address.length <= 254;
}

/** Splits on commas and semicolons that are not inside quotes or angle brackets. */
export function splitRecipients(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angle = 0;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (char === "<" && !quoted) angle += 1;
    else if (char === ">" && !quoted && angle > 0) angle -= 1;
    if ((char === "," || char === ";") && !quoted && angle === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function parseRecipients(text: string): ParsedRecipients {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const entry of splitRecipients(text)) {
    // "Name <address>" names its address explicitly; otherwise the entry is the address.
    const bracketed = /<([^<>]*)>/.exec(entry)?.[1] ?? entry;
    const found = (bracketed.match(ADDRESS) ?? []).filter(usable);
    if (found.length !== 1) {
      invalid.push(entry);
      continue;
    }
    const address = found[0].toLowerCase();
    if (!emails.includes(address)) emails.push(address);
  }
  return { emails, invalid };
}

/** The field's initial text for a draft whose recipients are plain addresses. */
export function formatRecipients(emails: string[]): string {
  return emails.join(", ");
}
