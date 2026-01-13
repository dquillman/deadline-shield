import { Request, Response } from "express";
import Stripe from "stripe";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const whsec = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, whsec);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  async function setUser(uid: string, patch: Record<string, any>) {
    await db.collection("users").doc(uid).set(patch, { merge: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = (session.metadata?.uid ?? "") as string;
      if (uid) {
        await setUser(uid, {
          stripeCustomerId: session.customer,
          status: "trialing"
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      const uid = (sub.metadata?.uid ?? "") as string;
      const plan = (sub.metadata?.plan ?? "none") as string;

      if (uid) {
        const status =
          sub.status === "active" ? "active" : sub.status === "trialing" ? "trialing" : "past_due";

        await setUser(uid, {
          stripeSubscriptionId: sub.id,
          plan,
          status
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const uid = (sub.metadata?.uid ?? "") as string;
      if (uid) {
        await setUser(uid, { status: "canceled" });
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    res.status(500).send(e.message);
  }
}
