# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run test       # Run Jest tests
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

To run a single test file: `npx jest path/to/test.test.ts`

## Architecture

**Atlas** is an Expo (React Native) fitness social app. Key tech:
- **Expo Router v6** — file-based routing; all screens live under `app/`
- **Zustand** — state management via stores in `stores/`
- **Supabase** — backend (PostgreSQL, Auth, Realtime); client initialized in `lib/supabase.ts`
- **AsyncStorage** — local persistence (primarily for active workout state)

### Navigation Flow

Expo Router uses group directories to separate concerns:

```
app/
├── (auth)/        — unauthenticated screens (login, signup, password reset)
├── (onboarding)/  — new user onboarding flow (7 steps)
├── (app)/
│   ├── (tabs)/    — bottom tab navigation (home, explore, workout, profile)
│   ├── (cards)/   — detail screens (profile/[userId], post/[postId], notifications, messages, settings)
│   └── (modals)/  — overlays (editPost, editRoutine, newWorkout)
└── (legal)/       — accessible from any auth state (eula, terms, privacy)
```

The root `app/_layout.tsx` handles auth-gating: checks Supabase session → email verified → onboarding completed, and redirects accordingly.

### State Management

Stores in `stores/` follow a Zustand pattern. Key stores:
- `authStore` — session, profile, loading state; syncs with Supabase auth
- `workoutStore` — active workout with exercises/sets; auto-saved to AsyncStorage
- `notificationStore` — notifications with Supabase Realtime subscription
- `postStore`, `profileStore`, `routineStore`, `messagesStore` — domain data
- `bannerStore`, `progressStore` — UI state for global banner and progress bar

### Data & Backend

All database operations go through the Supabase client in `lib/supabase.ts`. Utility functions in `utils/` handle domain-specific operations (e.g., `postUtils.ts`, `weightUtils.ts`, `routineUtils.ts`). Realtime subscriptions (notifications, messages) are set up inside the relevant stores.

### UI Conventions

- **FlashList** (from `@shopify/flash-list`) is preferred over FlatList for scrollable lists
- **Bottom sheets** use `@gorhom/bottom-sheet`
- **Skeleton loaders** exist for all async data views
- **CachedImage / CachedAvatar** components should be used instead of plain `<Image>` for user-generated content
- Color constants are in `constants/colors.ts` — never use inline color literals (ESLint enforces this)
- No inline styles (ESLint enforces this); use StyleSheet

### Workout Data Model

Sets track: weight, reps, RPE, and completion status. Exercises can be grouped into supersets. The workoutStore persists the entire active workout to AsyncStorage so it survives app restarts.

### Push Notifications

Setup in `hooks/usePushNotifications.ts`; service logic in `utils/pushNotificationService.ts`. Background fetch is enabled for notification syncing.
