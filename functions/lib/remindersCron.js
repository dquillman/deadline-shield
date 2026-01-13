"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRemindersCron = runRemindersCron;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * MVP STUB:
 * Later we’ll query tracks due within thresholds, then send via SendGrid/Twilio.
 * For now, we just prove the cron runs + writes an audit heartbeat.
 */
async function runRemindersCron() {
    await db.collection("system").doc("remindersCron").set({ lastRunAt: new Date().toISOString() }, { merge: true });
}
