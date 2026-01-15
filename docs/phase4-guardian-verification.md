# Phase 4 Guardian Mode Verification Checklist

Follow these steps to verify the judgment and deadline tracking capabilities of Phase 4.

## 1. Severity Scoring & "Why This Matters"

- [ ] **Action**: Add or modify a source to include a specific date change (e.g., "Deadline: Jan 30" -> "Deadline: Jan 15").
- [ ] **Action**: Run the `checkDeadlineUpdates` function.
- [ ] **Verification**: On the Dashboard, the change should be labeled as **HIGH** or **CRITICAL**.
- [ ] **Verification**: Hover over the severity badge. It should show reasons like "A deadline or date expression was modified."

## 2. Deadline Extraction & Countdown

- [ ] **Action**: Ensure a source contains a clear date format (e.g., "Registration ends March 1, 2026").
- [ ] **Action**: Run the check function.
- [ ] **Verification**: The source card should display "⏳ Next Deadline: 3/1/2026".
- [ ] **Verification**: Ensure the countdown badge correctly shows the number of days remaining.

## 3. Threshold-based Alerting

- [ ] **Action**: Set a source's `alertThreshold` to **HIGH** in Firestore.
- [ ] **Action**: Trigger a change that results in **LOW** severity (e.g., changing non-urgent text).
- [ ] **Verification**: Check logs to ensure NO email was sent.
- [ ] **Action**: Trigger a change that results in **CRITICAL** severity.
- [ ] **Verification**: Check logs/inbox to ensure the email was sent immediately.

## 4. Security Rules

- [ ] **Action**: Attempt to update `alertThreshold` from the frontend (you can add a temporary button or use dev tools).
- [ ] **Verification**: Ensure the update is permitted.
- [ ] **Action**: Attempt to update `severityScore` from the frontend.
- [ ] **Verification**: This should fail (client only has permission for settings, not judgment data).
