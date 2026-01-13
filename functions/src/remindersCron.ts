import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (!getApps().length) initializeApp();
const db = getFirestore();

/**
 * MVP STUB:
 * Later we’ll query tracks due within thresholds, then send via SendGrid/Twilio.
 * For now, we just prove the cron runs + writes an audit heartbeat.
 */
export async function runRemindersCron() {
  await db.collection("system").doc("remindersCron").set(
    { lastRunAt: new Date().toISOString() },
    { merge: true }
  );
}
