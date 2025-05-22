import { setupTokenCleanupJob } from "../../auth/jobs";
import { setupLobbyCleanupJob } from "../../lobby/jobs";

export function setupJobs() {
  setupLobbyCleanupJob();
  setupTokenCleanupJob();
}
