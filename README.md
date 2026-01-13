# Deadline Shield (MVP)

This repo contains:
- Next.js web app (apps/web)
- Firebase Cloud Functions (functions)

## Local dev (web)
1. Copy `apps/web/.env.local.example` -> `apps/web/.env.local` and fill values
2. Install deps and run:
   ```bash
   cd apps/web
   npm i
   npm run dev
   ```
3. Open http://localhost:3000

## Firebase setup (high level)
- Create Firebase project: `deadline-shield-prod`
- Enable Auth providers:
  - Google
  - Email link (passwordless)
- Create a Firebase Web App to get public config values.

## Deploy Firestore rules
```bash
firebase deploy --only firestore:rules
```

## Functions
### Required secrets (set in Firebase Functions env)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Deploy:
```bash
cd functions
npm i
npm run build
cd ..
firebase deploy --only functions
```

## Stripe webhook
Point Stripe webhooks at:
`https://us-central1-deadline-shield-prod.cloudfunctions.net/stripeWebhook`

Subscribe these event types:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
