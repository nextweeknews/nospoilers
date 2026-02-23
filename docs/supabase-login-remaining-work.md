# Supabase login integration: remaining work

This checklist captures what is still needed to fully wire login flows through Supabase across web + mobile.

## 1) Finalize environment and dashboard wiring

Follow this sequence for each environment (`dev`, `stage`, `prod`):

1. **Collect non-committed credentials and URLs**
   - From Supabase project settings, copy:
     - Project URL
     - `anon` public key (do **not** use service-role key in clients)
   - Keep these values in your secret manager / CI variables only.

2. **Set web runtime variables (per environment)**
   - Configure deployment/runtime env values:
     - `VITE_SUPABASE_URL=<project-url>`
     - `VITE_SUPABASE_ANON_KEY=<anon-key>`
     - `VITE_SUPABASE_AUTH_REDIRECT_URL=<web-origin>/auth/callback` (optional but recommended for explicitness)

3. **Set mobile runtime variables (per environment)**
   - Configure deployment/runtime env values:
     - `EXPO_PUBLIC_SUPABASE_URL=<project-url>`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
     - `EXPO_PUBLIC_SUPABASE_AUTH_DEEP_LINK_SCHEME=<app-scheme>`
     - `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL=<app-scheme>://auth/callback` (optional override)

4. **Keep repository defaults non-sensitive**
   - Leave `packages/types/src/env.ts` Supabase defaults empty.
   - Do not commit real `.env` files or raw keys.

5. **Configure Supabase Auth providers**
   - In Supabase Dashboard → Authentication → Providers:
     - Enable Email provider (email/password sign-in).
     - Enable Phone provider and configure Twilio SMS.
     - Enable Google provider with OAuth client ID/secret.
     - Keep Apple disabled unless intentionally adding Apple login.

6. **Configure callback and redirect URLs in Supabase**
   - In Authentication URL settings:
     - Set Site URL to your active web origin for that environment.
     - Add Additional Redirect URLs for:
       - `<web-origin>/auth/callback`
       - `<app-scheme>://auth/callback`
     - Ensure values exactly match app-configured redirect/deep-link URLs.

7. **Run security sanity checks before shipping**
   - Confirm no `SUPABASE_SERVICE_ROLE_KEY` exists in web/mobile app env.
   - Confirm only `anon` key is present in client env vars.
   - Rotate/revoke any key immediately if it was ever committed.

8. **Validate end-to-end by environment**
   - Web: start Google OAuth and verify return to `/auth/callback` with active session.
   - Mobile: start Google OAuth and verify return via deep link (`<app-scheme>://auth/callback`) with active session.
   - Phone: send and verify OTP successfully.

## 2) Remove duplicate auth client creation in login screens

Follow this sequence for both web and mobile login screens:

1. **Identify duplicate client creation points**
   - Web: remove direct `createClient(...)` usage in `apps/web/src/screens/LoginScreen.tsx`.
   - Mobile: remove direct `createClient(...)` usage in `apps/mobile/src/screens/LoginScreen.tsx`.

2. **Adopt shared auth services as the only source of truth**
   - Use `authClient` from each app’s `src/services/authClient.ts`.
   - Use `authRedirectTo` and `signInWithGoogle` helpers instead of per-screen redirect logic where possible.

3. **Centralize shared auth behavior**
   - Keep all Supabase auth options (`pkce`, session persistence, `detectSessionInUrl`, storage settings) only in `src/services/supabaseClient.ts`.
   - Avoid duplicating these options in UI-layer components.

4. **Extract shared mapping logic**
   - Move `User/Session -> ProviderLoginResult` mapping into a shared helper (per platform or shared package), then call it from login flows.
   - Ensure provider mapping behavior remains consistent across web/mobile.

5. **Confirm flow parity after refactor**
   - Re-test phone OTP, Google OAuth, and email/password flows in both apps.
   - Verify success/failure statuses are still surfaced to users.

## 3) Complete OAuth callback/session recovery handling

Follow this sequence to make callback handling deterministic and recoverable:

1. **Web callback routing and hosting rewrites**
   - Ensure `<web-origin>/auth/callback` is routed back to the SPA entrypoint in each deployment target.
   - Verify direct page refresh on `/auth/callback` does not return 404.

2. **Web session exchange/hydration**
   - Keep `detectSessionInUrl: true` in web Supabase client.
   - On app bootstrap, call `authClient.getSession()` and hydrate local auth state before rendering gated UI.

3. **Mobile deep-link callback consistency**
   - Ensure Expo scheme config matches `EXPO_PUBLIC_SUPABASE_AUTH_DEEP_LINK_SCHEME`.
   - Ensure generated redirect URI equals `<scheme>://auth/callback` unless explicitly overridden.

4. **Mobile token finalization path**
   - Keep callback parsing + `setSession(...)`, but extract to a shared utility in `src/services` rather than screen-local code.
   - Normalize error handling for missing/invalid callback tokens.

5. **Auth listener integration**
   - Subscribe to `onAuthStateChange` in app root to capture session establishment from callback completion.
   - Unsubscribe listener on teardown to prevent duplicate events.

6. **Regression validation**
   - Validate Google OAuth sign-in from a logged-out state and from a stale session state.
   - Validate callback handling remains stable after app reloads and browser back navigation.

## 4) Gate app UI on actual auth state + persist sessions

Follow this sequence in both app roots:

1. **Create explicit auth bootstrap state**
   - Add `authLoading` and `currentUser/currentSession` state.
   - Initialize `authLoading=true` until first session read completes.

2. **Hydrate from persisted session first**
   - On startup, call `authClient.getSession()`.
   - If session exists, map user and set signed-in state before showing protected UI.

3. **Subscribe to session changes**
   - Register `onAuthStateChange` once in root scope.
   - Update local signed-in state on `SIGNED_IN`, `TOKEN_REFRESHED`, and `SIGNED_OUT` events.

4. **Gate rendering paths**
   - While `authLoading`, show loading/splash state.
   - Render `LoginScreen` only when no valid session/user exists.
   - Render main app surfaces only when session/user is present.

5. **Prevent mixed logged-out/logged-in UI**
   - In mobile app, do not render group/account screens while logged out.
   - In web app, keep logout and route transitions tied to auth state source of truth.

6. **Verify persistence behavior**
   - Reload web app and restart mobile app; verify signed-in state restores.
   - Sign out and confirm session/user state clears immediately and stays cleared on reload.

## 5) Wire logout to Supabase sign-out

Follow this sequence for all logout entry points:

1. **Use shared sign-out helper**
   - Route logout actions through `signOut()` from `src/services/authClient.ts`.
   - Remove direct state-only logout handlers that skip Supabase sign-out.

2. **Sequence logout safely**
   - Call Supabase `signOut()` first.
   - On success, clear local user/session/UI state.

3. **Handle and surface failures**
   - If sign-out fails, show user-visible status and keep state consistent.
   - Avoid partially clearing state when remote sign-out fails unless explicitly desired.

4. **Instrument telemetry and logs**
   - Emit structured logout success/failure events.
   - Ensure no sensitive token values are logged.

5. **Cross-platform validation**
   - Web: logout from account menu and confirm session invalidation + login screen return.
   - Mobile: logout and confirm tabs/protected screens are no longer reachable until re-auth.

## 6) Add minimal auth regression checks

Follow this sequence for a small but durable auth test baseline:

1. **OAuth redirect selection tests**
   - Add tests asserting configured redirect envs are preferred.
   - Add tests asserting fallback redirect (`/auth/callback` web, deep-link scheme mobile) when env override is absent.

2. **Session/user mapping tests**
   - Add tests for mapping Supabase `Session`/`User` into `ProviderLoginResult`.
   - Cover provider identity mapping (`sms -> phone`, `google`, `email`) and optional metadata fields.

3. **Auth hydration tests**
   - Add tests for app bootstrap with existing session (restores signed-in UI).
   - Add tests for empty/expired session (renders login UI).

4. **Callback finalization tests**
   - Mobile: test parsing callback URL and `setSession` handoff behavior.
   - Web: test callback session detection path and initial state hydration.

5. **Logout behavior tests**
   - Assert logout triggers Supabase sign-out call.
   - Assert signed-in state is cleared only after expected sign-out path.

6. **CI integration**
   - Run auth tests in CI on pull requests touching auth/login code.
   - Keep fixtures token-safe (no real credentials committed).
