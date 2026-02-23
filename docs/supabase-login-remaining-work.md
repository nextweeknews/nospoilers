# Supabase login integration: remaining work

This checklist captures what is still needed to fully wire login flows through Supabase across web + mobile.

## 1) Finalize environment and dashboard wiring

- Populate real values for `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (web) and `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile) in each environment.
- Keep shared defaults in `packages/types/src/env.ts` empty and inject real secrets via deployment/runtime env (do not commit secrets).
- In Supabase Auth settings for each environment (`dev`, `stage`, `prod`), verify:
  - Email + phone + Google providers are enabled.
  - Allowed redirects include web callback (`/auth/callback`) and mobile deep link callback (`<scheme>://auth/callback`).

## 2) Remove duplicate auth client creation in login screens

Current login screens instantiate their own Supabase clients instead of using the shared clients in `src/services/supabaseClient.ts` and `src/services/authClient.ts`.

- Refactor web and mobile `LoginScreen` to use the shared auth helpers (`authClient`, `authRedirectTo`, `signInWithGoogle`).
- Keep one source of truth for auth options (`pkce`, session persistence, redirect behavior).

## 3) Complete OAuth callback/session recovery handling

- **Web**:
  - Ensure `/auth/callback` resolves to the SPA in hosting rewrites.
  - Parse/exchange callback session on first load (or rely on `detectSessionInUrl: true` via shared client) and hydrate app auth state.
- **Mobile**:
  - Ensure app deep-link scheme is configured in Expo app config and matches `EXPO_PUBLIC_SUPABASE_AUTH_DEEP_LINK_SCHEME`.
  - Continue callback token extraction + `setSession`, but move it to shared auth flow utilities for reuse/testability.

## 4) Gate app UI on actual auth state + persist sessions

- Subscribe to Supabase auth state (`getSession` + `onAuthStateChange`) in app roots.
- Render `LoginScreen` only when no active session/user is present.
- Restore signed-in users on app reload/restart from persisted Supabase sessions.

## 5) Wire logout to Supabase sign-out

- Update logout actions to call `signOut()` (from shared auth client) before clearing local user state.
- Handle sign-out failures with user-visible status and telemetry.

## 6) Add minimal auth regression checks

- Add focused unit/integration coverage for:
  - OAuth redirect URL selection (configured vs fallback).
  - Mapping Supabase `Session`/`User` to `ProviderLoginResult`.
  - Login state hydration from existing session.
