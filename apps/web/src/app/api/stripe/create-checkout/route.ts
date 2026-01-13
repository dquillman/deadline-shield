import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

type Body = { plan: "solo" | "pro" | "team"; uid: string };

const priceIdForPlan = (plan: Body["plan"]) => {
  const map = {
    solo: process.env.STRIPE_PRICE_SOLO!,
    pro: process.env.STRIPE_PRICE_PRO!,
    team: process.env.STRIPE_PRICE_TEAM!
  };
  return map[plan];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.uid || !body?.plan) {
    return NextResponse.json({ error: "Missing uid/plan" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceIdForPlan(body.plan), quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { uid: body.uid, plan: body.plan }
    },
    metadata: { uid: body.uid, plan: body.plan },
    success_url: `${appUrl}/dashboard`,
    cancel_url: `${appUrl}/billing`
  });

  return NextResponse.json({ url: session.url });
}
