# Phase 7: Final Polish & Trust Verification Checklist

Verify that Deadline Shield now provides a smooth, trustworthy experience for first-time and long-term users.

## 1. Product Positioning

- [ ] **Action**: Visit the landing page (`/`).
- [ ] **Verification**: Ensure the sentence starting with "Deadline Shield watches important pages..." is prominent.

## 2. First-Run Onboarding

- [ ] **Action**: Create a new account and log in.
- [ ] **Verification**: Ensure the 3-step tour overlay appears immediately.
- [ ] **Verification**: Confirm Step 1 explains "What we watch".
- [ ] **Verification**: Confirm Step 2 explains "How alerts work".
- [ ] **Verification**: Confirm Step 3 explains "What Guardian does".
- [ ] **Action**: Click "Got it" on Step 3.
- [ ] **Verification**: Dashboard is revealed and tour does not reappear on refresh.

## 3. Empty States & Feedback Loop

- [ ] **Action**: View an account with zero sources.
- [ ] **Verification**: Empty state says "No sources added yet. Deadline Shield is watching quietly."
- [ ] **Action**: Add a source, but ensure it has no detected changes (or acknowledge any changes).
- [ ] **Verification**: The green "All monitored deadlines are currently under control" banner appears.
- [ ] **Action**: Trigger a change on that source.
- [ ] **Verification**: The green banner disappears until that change is acknowledged.

## 4. Guardian Gating & Soft-Copy

- [ ] **Action**: Log in as a Starter user.
- [ ] **Verification**: Hover over the "Guardian Preview" badge and ensure the tooltip explains that Guardian tells you *why* changes matter.
- [ ] **Verification**: Note the subtle sub-header: "Guardian explains why changes matter" appears in the Status column.

## 5. Go-Live Readiness

- [ ] **Action**: Review [go-live-checklist.md](file:///g:/Users/daveq/deadline-shield/docs/go-live-checklist.md).
- [ ] **Verification**: All operational boxes are mentally checked.
