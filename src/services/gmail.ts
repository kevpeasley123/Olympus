import { invoke, isTauri } from "@tauri-apps/api/core";
export interface MailExcerpt { provider:string; accountId:string; messageId:string; threadId:string; sender:string; subject:string; timestamp:number; excerpt:string; fingerprint:string; retrievedAt:string; bodyStatus:string; cachedThreadSubset:boolean }
export interface MailMessage { id:string; threadId:string; sender:string; recipients:string; subject:string; internalDate:number; canonicalText:string; cleanText:string; bodyStatus:string; attachments:{filename:string;mimeType:string;size:number}[] }
export interface GmailStatus { configured:boolean; configPath:string; busy:boolean; cachedMessages:number; account:null|{id:string;email:string;enabled:boolean;status:string;horizonDays:number;lastSuccess:string|null;lastAttempt:string|null;lastError:string|null;nextSync:string|null}; lastRun:null|{status:string;mode:string;changes:number;error:string|null}; candidates:{kind:string;text:string;messageId:string;threadId:string;accountId:string;fingerprint:string;sender:string;subject:string;timestamp:number}[] }
export const gmailNative = isTauri;
export const gmailStatus=()=>invoke<GmailStatus>("gmail_status");
export const gmailAction=(action:"connect"|"disconnect"|"sync"|"cancel")=>invoke<void>(`gmail_${action}`);
export const gmailHorizon=(days:number)=>invoke<void>("gmail_set_horizon",{days});
export const gmailSearch=(query:string)=>invoke<MailExcerpt[]>("gmail_search",{query});
export const gmailThread=(threadId:string)=>invoke<MailMessage[]>("gmail_thread",{threadId});
export function gmailStateLabel(state:GmailStatus|null):string {if(!state)return "Loading connection…";if(state.busy)return state.account?.status==="syncing"?"Synchronizing…":"Connection operation in progress…";if(!state.account?.enabled)return "Not connected";return ({connected:"Connected · read only",sync_error:"Sync error",authentication_required:"Authentication required",syncing:"Synchronizing…"} as Record<string,string>)[state.account.status]??"Connection needs review";}
export function gmailError(code:unknown):string {const key=String(code);const known:Record<string,string>={gmail_api_disabled:"Enable Gmail API in the Google Cloud project that owns this Desktop OAuth client, then retry.",gmail_scope_insufficient:"Google reports insufficient permission. Reconnect and grant the requested read-only Gmail permission.",gmail_quota_exceeded:"Google reports an exhausted API quota. Check this project’s Gmail API quota and retry after it resets.",gmail_domain_policy:"Your Google Workspace administrator blocks this application’s Gmail access.",gmail_client_config_missing:"Save your Desktop OAuth client file at the path shown below.",gmail_requires_desktop_client:"This configuration must be a Google Desktop app OAuth client.",oauth_cancelled:"Authorization cancelled. Existing connection settings were preserved.",oauth_state_mismatch:"Authorization response could not be verified. Please connect again.",oauth_callback_timeout:"Authorization timed out. Choose Connect to try again.",gmail_authentication_required:"Google authorization has expired or was revoked. Reconnect Gmail.",gmail_credential_missing:"The Windows credential is missing. Reconnect Gmail.",gmail_secure_store_unavailable:"Windows Credential Manager could not be accessed. If disconnecting, sync is stopped but credential removal must be retried.",gmail_network_unavailable:"Network unavailable. The previous cache and cursor are preserved.",gmail_scope_limit_reduce_horizon:"This sync exceeds the 2,000-message safety limit. Choose a smaller date range and sync again.",gmail_sync_budget_reduce_horizon:"This sync exceeded its 10-minute budget before committing. Choose a smaller date range and sync again.",gmail_batch_limit_reduce_horizon:"This sync exceeds the 32 MB text safety limit. Choose a smaller date range and sync again.",gmail_rate_limited:"Google rate-limited this sync. Olympus will retry on its next cadence.",gmail_access_or_quota_denied:"Google denied access or quota. Check Gmail API enablement and consent, then retry.",gmail_operation_running:"Another Gmail operation is still running.",gmail_disconnect_before_switching_account:"Disconnect the current account before connecting a different account.",gmail_cancelled:"Sync cancelled. The previous committed cache is preserved."};return known[key]??`Gmail could not complete this operation (${key.replace(/[^a-zA-Z0-9_]/g, "").slice(0,90)}). Retry or check the setup guide.`;}

export const gmailRemoveCache=()=>invoke<void>("gmail_remove_cache",{confirmed:true});

/** What removal (or a narrower history range) would delete, counted read-only by the backend. */
export interface GmailCacheCounts {
  accountId: string;
  messages: number;
  situations: number;
  updates: number;
  drafts: number;
  analysisRuns: number;
  documentContexts: number;
  documentSources: number;
  olderThan: null | { days: number; messages: number };
}
export const gmailCacheCounts = (olderThanDays?: number) =>
  invoke<GmailCacheCounts>("gmail_cache_counts", olderThanDays ? { olderThanDays } : {});

/** "1 message", "2 messages", "1,842 messages". */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

const AUTH_ERRORS = new Set(["gmail_authentication_required", "gmail_credential_missing", "gmail_scope_insufficient"]);

/**
 * The Gmail connection as the header should state it. It never says
 * "Connected" on its own while an error is recorded, and each problem carries
 * the one action that recovers from it (review U12).
 */
export interface GmailHealth {
  state: "loading" | "disconnected" | "connected" | "syncing" | "auth" | "sync-failed";
  label: string;
  /** Plain-language cause, when something is wrong. */
  detail?: string;
  action?: "reconnect" | "retry-sync";
  /** The backend's scheduled next sync after a failure; never estimated here. */
  nextAttemptAt?: string | null;
}

export function gmailHealth(state: GmailStatus | null): GmailHealth {
  if (!state) return { state: "loading", label: "Loading connection…" };
  const account = state.account;
  if (!account?.enabled) return { state: "disconnected", label: "Not connected" };
  if (state.busy || account.status === "syncing") return { state: "syncing", label: "Connected · syncing…" };
  if (account.status === "authentication_required" || AUTH_ERRORS.has(account.lastError ?? "")) {
    return { state: "auth", label: "Authentication required", detail: gmailError(account.lastError ?? "gmail_authentication_required"), action: "reconnect" };
  }
  if (account.lastError || account.status === "sync_error") {
    return { state: "sync-failed", label: "Connected · sync failed", detail: gmailError(account.lastError ?? "gmail_sync_failed"), action: "retry-sync", nextAttemptAt: account.nextSync };
  }
  return { state: "connected", label: "Connected · read only" };
}

/*
 * "Open Gmail settings" from Communications: Preferences opens with the Gmail
 * section already expanded. A pending flag rather than an event, because the
 * section mounts only once the dialog has opened.
 */
let gmailSettingsRequested = false;
export function requestGmailSettings(): void { gmailSettingsRequested = true; }
export function takeGmailSettingsRequest(): boolean {
  const requested = gmailSettingsRequested;
  gmailSettingsRequested = false;
  return requested;
}
