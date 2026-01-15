# Phase 3 Hardening Verification Checklist

Follow these steps to verify the stability and functionality of the Phase 3 Hardening features.

## 1. High-Accountability Manual Verification

- [ ] **Action**: Go to Dashboard, find a source with a "Changed" or "Blocked" status.
- [ ] **Action**: Click "Verify Change".
- [ ] **Verification**: Ensure the "Verify Snapshot" dialog appears with Reason and Note fields.
- [ ] **Action**: Select a reason (e.g., "Expected Change"), enter a note, and save.
- [ ] **Verification**: The source should now show a "Verified" badge with the reason.
- [ ] **Verification**: Check the `audit_logs` collection in Firestore. Verify the entry has `verifiedHash`, `verifiedReason`, and a `sourceSnapshot` object.

## 2. Pause / Resume Controls

- [ ] **Action**: Click "Pause" on a source.
- [ ] **Verification**: Ensure the "Pause Monitoring" dialog appears.
- [ ] **Action**: Select a reason and save.
- [ ] **Verification**: Source status changes to "PAUSED".
- [ ] **Action**: Click "Resume".
- [ ] **Verification**: Source status changes back to "OK" and `nextCheckAt` is updated to a near-future timestamp.

## 3. Automated Backoff (Simulation)

- [ ] **Action**: Manually set a source URL to a non-existent domain (e.g., `https://this-domain-does-not-exist-123.com`).
- [ ] **Action**: Trigger the Cloud Function `checkDeadlineUpdates` manually (or wait for the schedule).
- [ ] **Verification**: After 1 fail, `status` is "ERROR".
- [ ] **Verification**: After 2 fails, `nextCheckAt` should be increased by 30 mins.
- [ ] **Verification**: After 5+ fails, `status` should change to "DEGRADED" and backoff to 24-hour intervals.

## 4. Reliability Locking

- [ ] **Action**: Manually set `inProgressUntil` on a source document to a future timestamp (e.g., +10 mins).
- [ ] **Action**: Run `checkDeadlineUpdates`.
- [ ] **Verification**: Check logs to ensure the source was skipped with "is locked. Skipping."

## 5. Security Rules

- [ ] **Action**: Try to use a client side `updateDoc` to change the `name` or `url` of an existing source.
- [ ] **Verification**: This should fail with a permission error (rules only allow Phase 3 fields to be updated by the client).
