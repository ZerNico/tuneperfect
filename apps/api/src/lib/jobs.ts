import { setupTokenCleanupJob } from "../auth/jobs";
import { setupClubCleanupJob } from "../club/jobs";
import { setupLobbyCleanupJob } from "../lobby/jobs";

export function setupJobs() {
  setupLobbyCleanupJob();
  setupTokenCleanupJob();
  setupClubCleanupJob();
}
