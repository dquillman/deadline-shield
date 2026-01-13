"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhookHandler = stripeWebhookHandler;
const stripe_1 = __importDefault(require("stripe"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
async function stripeWebhookHandler(req, res) {
    const sig = req.headers["stripe-signature"];
    const whsec = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, whsec);
    }
    catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    async function setUser(uid, patch) {
        await db.collection("users").doc(uid).set(patch, { merge: true });
    }
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const uid = (session.metadata?.uid ?? "");
            if (uid) {
                await setUser(uid, {
                    stripeCustomerId: session.customer,
                    status: "trialing"
                });
            }
        }
        if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
            const sub = event.data.object;
            const uid = (sub.metadata?.uid ?? "");
            const plan = (sub.metadata?.plan ?? "none");
            if (uid) {
                const status = sub.status === "active" ? "active" : sub.status === "trialing" ? "trialing" : "past_due";
                await setUser(uid, {
                    stripeSubscriptionId: sub.id,
                    plan,
                    status
                });
            }
        }
        if (event.type === "customer.subscription.deleted") {
            const sub = event.data.object;
            const uid = (sub.metadata?.uid ?? "");
            if (uid) {
                await setUser(uid, { status: "canceled" });
            }
        }
        res.json({ received: true });
    }
    catch (e) {
        res.status(500).send(e.message);
    }
}
