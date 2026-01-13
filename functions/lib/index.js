"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remindersCron = exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const stripeWebhook_1 = require("./stripeWebhook");
const remindersCron_1 = require("./remindersCron");
exports.stripeWebhook = (0, https_1.onRequest)({ region: "us-central1" }, stripeWebhook_1.stripeWebhookHandler);
// Hourly cron (adjust later)
exports.remindersCron = (0, scheduler_1.onSchedule)({ region: "us-central1", schedule: "every 60 minutes" }, async () => (0, remindersCron_1.runRemindersCron)());
