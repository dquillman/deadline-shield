# Phase 6: Closure, Learning & Monetization Verification Checklist

Verify that Deadline Shield now provides closure, learns from your decisions, and demonstrates clear value for the paid tier.

## 1. Action Acknowledgement (Closure Loop)

- [ ] **Action**: Expand a source with a **Changed** status and a recommendation (e.g., REVIEW).
- [ ] **Action**: Click "Mark Reviewed".
- [ ] **Verification**: The row should become muted (lower opacity/grayscale).
- [ ] **Verification**: The recommendation badge should disappear and be replaced by "✅ Resolved (REVIEWED)".
- [ ] **Verification**: Check Firestore `audit_logs` for an `ACKNOWLEDGE_CHANGE` entry.

## 2. Confidence Learning Engine

- [ ] **Action**: Set a source's `confidenceScore` to 90 directly in Firestore.
- [ ] **Action**: Trigger a change that does NOT involve a date change.
- [ ] **Verification**: Check logs to see if "Historically stable with low noise; dampening minor change" reason is added.
- [ ] **Action**: Trigger a **CRITICAL** deadline change (date moved earlier).
- [ ] **Verification**: Ensure the severity is NOT dampened and remains **CRITICAL** (safety guardrail).

## 3. Tier Gating

- [ ] **Action**: Log in as a user with `plan: "Starter"` in Firestore.
- [ ] **Action**: View a source with a detected change.
- [ ] **Verification**: Ensure the "Action Guidance" badge is replaced by a "🔒 Guardian Preview" locked badge.
- [ ] **Action**: Log in as a user with `plan: "Pro"`.
- [ ] **Verification**: Ensure all Action Badges and Guidance tooltips are fully visible.

## 4. Weekly Digest

- [ ] **Action**: Acknowledge all high-severity changes for a user.
- [ ] **Action**: Trigger the `sendWeeklyDigest` function manually.
- [ ] **Verification**: Ensure the email does NOT list the acknowledged changes in the "critical changes pending" list.
