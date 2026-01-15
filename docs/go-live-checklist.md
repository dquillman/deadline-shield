# Go-Live Readiness Checklist: Deadline Shield

Ensure these operational and product-quality checks are complete before inviting users.

## 1. Product & UX

- [ ] **Authority Positioning**: Landing page clearly states: "Deadline Shield watches important pages, detects meaningful changes, and tells you what to do — so you don’t miss critical deadlines."
- [ ] **Onboarding**: First-run experience appears once (3 steps) and correctly explains what we watch, how we alert, and what Guardian does.
- [ ] **Empty States**: Reassuring copy shown when no sources or changes exist ("Deadline Shield is watching quietly").
- [ ] **Trust Loop**: "You're Covered" message appears when all actions are acknowledged.
- [ ] **Guardian Preview**: Soft-copy explanation of gated features is present for free users.

## 2. Technical & Security

- [ ] **Firestore Rules**: Hardened tier limits and ownership checks verified.
- [ ] **Email Alerts**: SendGrid API key is active and alert volume is sanity-checked.
- [ ] **Backoff Logic**: 403/500 backoff levels verified to work without triggering infinite retries.
- [ ] **Manual Verification**: Workflow for "Needs Manual Verification" confirmed and audit trail logging verified.

## 3. Monetization

- [ ] **Tier Gating**: Plan-based limits and feature access confirmed for Starter vs Pro tiers.
- [ ] **Billing**: Ensure Stripe/Billing integration (if outside this MVP scope) has a clear path.

## 4. Operational

- [ ] **Support Path**: Users know where to go if they find a "False Positive".
- [ ] **Logs**: Cloud Logging is active and tracking Guardian scoring/learning hits.
- [ ] **Maintenance**: Weekly digest scheduled and working.

## 5. Calm Factor

- [ ] **Copy Review**: Ensure no aggressive language, "AI" buzzwords, or unnecessary urgency.
- [ ] **Dashboard Feel**: Table remains clean and signal-to-noise ratio is high.
