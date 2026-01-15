# Phase 8: Theme Toggle Verification Checklist

Verify that the theme toggle feature works correctly with instant switching, persistence, and cross-device sync.

## 1. Theme Switching

- [ ] **Action**: Log in to the dashboard.
- [ ] **Action**: Click the ⚙️ Settings icon in the top-right header.
- [ ] **Verification**: Settings menu opens with "Appearance" options (System / Light / Dark).
- [ ] **Action**: Select "Light" mode.
- [ ] **Verification**: UI instantly switches to light theme.
- [ ] **Action**: Select "Dark" mode.
- [ ] **Verification**: UI instantly switches to dark theme with appropriate colors.
- [ ] **Action**: Select "System" mode.
- [ ] **Verification**: UI follows your OS theme setting.

## 2. Persistence (localStorage)

- [ ] **Action**: Select "Dark" mode.
- [ ] **Action**: Refresh the page (F5).
- [ ] **Verification**: Dark mode persists after refresh.

## 3. System Mode Follows OS

- [ ] **Action**: Select "System" mode in the app.
- [ ] **Action**: Change your OS theme (Windows: Settings > Personalization > Colors).
- [ ] **Verification**: App theme automatically updates to match OS.

## 4. Firestore Cross-Device Sync

- [ ] **Action**: Select "Light" mode on Device A.
- [ ] **Action**: Log in to the same account on Device B (or different browser).
- [ ] **Verification**: Theme is "Light" on Device B (synced from Firestore).
- [ ] **Note**: Check Firestore console → `users/{uid}` → Verify `themePreference: "light"` field exists.

## 5. Console Checks

- [ ] **Action**: Open browser DevTools console.
- [ ] **Verification**: No hydration mismatch warnings.
- [ ] **Verification**: No errors related to next-themes or theme switching.
