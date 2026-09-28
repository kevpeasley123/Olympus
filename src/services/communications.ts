import { invoke } from '@tauri-apps/api/core';
import { gmailStatus, gmailAction, gmailThread, gmailSearch, gmailNative } from './gmail';
export type Group = 'inbox' | 'attention' | 'actions' | 'projects' | 'people' | 'search';
export interface CommunicationRow {
    id: string;
    threadId: string;
    timestamp: number;
    fingerprint: string;
    sender: string;
    subject: string;
    preview: string;
    labels: string[];
    candidates: {
        kind: string;
        text: string;
    }[];
}
export interface Workspace {
    days: number;
    horizonDays: number;
    total: number;
    attention: number;
    actions: number;
    deadlines: number;
    projects: number;
    inbox: number;
    sent: number;
    threads: number;
    people: {
        sender: string;
        count: number;
    }[];
    activity: {
        timestamp: number;
        received: number;
        sent: number;
    }[];
    matches: number;
    rows: CommunicationRow[];
    signals: CommunicationRow[];
    page: number;
    comparison: null;
}
export const workspace = (days: number, group: Group, sender: string, page: number) => invoke<Workspace>('gmail_workspace', { days, group: group === 'search' ? 'inbox' : group, sender, page });
/**
 * Prepares a question about one cached thread in the console without sending
 * it. The thread reference travels as attached context, not as prompt text;
 * the native side resolves it against the enabled account and scope.
 */
export function askAboutThread(threadId: string, subject: string): void {
    window.dispatchEvent(new CustomEvent('olympus:focus-console', { detail: {
        prompt: 'Summarize this cached Gmail thread and identify possible response needs.',
        label: `Gmail thread · ${subject || '(No subject)'}`,
        heading: 'Gmail thread reference',
        context: `[Gmail thread: ${threadId}]`
    } }));
}
export const communicationsClient ={ native: gmailNative, status: gmailStatus, action: gmailAction, thread: gmailThread, search: gmailSearch, workspace };
export type CommunicationsClient = typeof communicationsClient;
