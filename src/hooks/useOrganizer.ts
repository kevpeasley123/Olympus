import { createPollingStore } from "./createPollingStore";
import { listOrganizer, organizerMessage, type OrganizerOverview } from "../services/organizer";
import { isTauriRuntime } from "../services/launcher";
const store = createPollingStore<OrganizerOverview[]>({ intervalMs: 5000, initial: [], fetcher: async () => {
        if (!isTauriRuntime())
            throw Error("Organizer requires the Olympus desktop connection.");
        try {
            return await listOrganizer();
        }
        catch (e) {
            throw Error(organizerMessage(e));
        }
    } });
export const useOrganizer = () => store();
export const refreshOrganizer = () => store.refresh({ force: true });
