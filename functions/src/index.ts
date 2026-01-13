import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { stripeWebhookHandler } from "./stripeWebhook";
import { runRemindersCron } from "./remindersCron";

export const stripeWebhook = onRequest({ region: "us-central1" }, stripeWebhookHandler);

// Hourly cron (adjust later)
export const remindersCron = onSchedule(
  { region: "us-central1", schedule: "every 60 minutes" },
  async () => runRemindersCron()
);
