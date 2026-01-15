# Phase 5: Action Guidance & Confidence Verification Checklist

Verify that Deadline Shield now provides calm, actionable guidance and reassurance.

## 1. Action Guidance (Deterministic Logic)

- [ ] **Action**: Trigger a **LOW** severity change.
- [ ] **Verification**: Dashboard Action Badge should show **✅ NO ACTION**. Tooltip should say "No action needed."
- [ ] **Action**: Trigger a **MEDIUM** severity change.
- [ ] **Verification**: Dashboard Action Badge should show **🔍 REVIEW**. Tooltip should say "Review this change..."
- [ ] **Action**: Trigger a **CRITICAL** change where the deadline stays the same.
- [ ] **Verification**: Dashboard Action Badge should show **📝 UPDATE**.
- [ ] **Action**: Trigger a **CRITICAL** change where the deadline moves earlier.
- [ ] **Verification**: Dashboard Action Badge should show **🚨 ESCALATE**. Tooltip should say "Immediate attention recommended."

## 2. Confidence Layer (Reassurance)

- [ ] **Action**: Modify a source that has high volatility (>0.6 score in Firestore).
- [ ] **Verification**: Tooltip should include: "This type of page changes frequently; urgency is moderate."
- [ ] **Action**: Trigger a change that doesn't affect a deadline.
- [ ] **Verification**: Tooltip should include: "No deadlines were identified or removed in this update."
- [ ] **Action**: Check a source that has been previously verified (`lastVerifiedAt` is set).
- [ ] **Verification**: Tooltip should include: "You've successfully verified similar changes on this source before."

## 3. Alert Content Upgrade

- [ ] **Action**: Trigger a high-severity alert.
- [ ] **Verification**: Check the alert email.
- [ ] **Check**: Does the subject include the Action Category? (e.g., `📝 UPDATE: [HIGH] Source Name`)
- [ ] **Check**: Does the body lead with the Recommended Action?
- [ ] **Check**: Are the Confidence Notes present at the bottom?

## 4. UI Cleanliness

- [ ] **Verification**: Ensure the Action Badges are compact and do not clutter the "Last Change" column.
- [ ] **Verification**: Ensure tooltips are readable and informative without being overwhelming.
