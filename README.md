# NoSpoilers Monorepo Skeleton

This repository is organized as a monorepo with clear boundaries:

- `apps/web`: React web shell
- `apps/mobile`: React Native/Expo-style mobile shell
- `packages/ui`: shared design system tokens + shell components
- `packages/types`: shared API and environment config types

## Environment config

Both apps consume shared environment constants from `@nospoilers/types`.

Supported environments: `dev`, `stage`, `prod`.

Override variables per platform:

### Web
- `VITE_APP_ENV`
- `VITE_API_URL`
- `VITE_AUTH_CLIENT_ID`

### Mobile
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_AUTH_CLIENT_ID`

## Supabase Authentication dashboard alignment

Apply these Supabase Dashboard settings per environment (`dev`, `stage`, `prod`) under **Authentication**:

1. Enable **Email** provider (email/password sign-in enabled).
2. Enable **Phone** provider and configure **Twilio** SMS credentials.
3. Enable **Google** provider with Google Cloud OAuth client ID and client secret.
4. Disable **Apple** provider.
5. Configure allowed redirect URLs to include:
   - Web callback URLs (`<web-origin>/auth/callback`)
   - Mobile deep-link callback URLs (`<scheme>://auth/callback`)
6. Verify **Site URL** and **Additional Redirect URLs** include all `dev`/`stage`/`prod` endpoints.

Frontend redirect/deep-link sources must exactly match Supabase dashboard values:

- **Web OAuth redirect**: `VITE_SUPABASE_AUTH_REDIRECT_URL` (fallback: `${window.location.origin}/auth/callback`).
- **Mobile OAuth redirect**: `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL` (fallback derived from `EXPO_PUBLIC_SUPABASE_AUTH_DEEP_LINK_SCHEME` and `auth/callback`).

## Auth service module

A new shared auth module lives at `services/auth` and provides:

- Phone sign-in with one-time SMS verification codes
- OAuth sign-in for Google and Apple
- Email/password fallback support
- Access + refresh token session strategy
- Encrypted-at-rest auth metadata storage
- TLS-only transport checks and secure token storage enforcement
- Account linking across providers (phone, social, email)

## Content media ingestion/search service

`services/content` now supports a media-ingestion/search workflow for group experiences:

- Normalizes external identifiers for ingestion/search (`isbn`, `imdb`, `tmdb`, `tvdb`, `asin`)
- Stores media title, artwork, creator metadata, and unit structure (chapters/episodes)
- Caches repeated search queries and tracks popular queries for responsive UI surfaces
- Exposes service APIs for:
  - searching by title or external identifier
  - selecting active media for a group
  - retrieving group media title/artwork for top bar + side navigation
- Includes manual/fallback media entry tooling via `upsertManualMediaItem` for incomplete provider metadata

## Security controls and abuse prevention

### Auth endpoint protections

`services/auth` enforces in-memory per-identity rate limiting on:

- OTP send (`startPhoneLogin`)
- OTP verify (`verifyPhoneCode`)
- Login attempts (`loginWithEmailPassword`, `loginWithOAuth`)

When limits are exceeded, requests are blocked for a cool-down window and suspicious activity scores are incremented.

### Abuse controls

`services/content` adds invite spam throttling (`createInviteLink`) to cap invite generation bursts per user.

Suspicious behavior is tracked for:

- Invalid or malformed invite token usage
- Invite overuse attempts
- Repeated auth failures and rate-limit violations

Use `getSuspiciousActivity(...)` in both services for operations review and abuse triage.

### Input validation and output encoding

User-generated text inputs are validated and sanitized before persistence, including:

- Profile display names and usernames
- Manual media metadata
- Media item titles/descriptions/creator fields
- Post preview/body content

All sanitized text paths apply defensive HTML entity encoding to reduce XSS risks in downstream renderers.

### Structured audit logs

`services/auth` emits structured auth audit events via `getAuthAuditLog(...)` for:

- OTP send/verify (success/failure)
- Email and OAuth logins
- Session refresh and logout

`services/content` emits structured content audit events via `getContentAuditEvents(...)` for:

- Invite acceptance attempts and outcomes
- Group privacy visibility changes
- Progress rollback attempts and results

Progress roll-forward/rollback details remain available in `getProgressAuditTrail(...)`.

## Monitoring, alerting, and error tracking defaults

For web/mobile/backend deployments, use these defaults:

- **Web**: export structured frontend errors (network/auth/render failures), route to centralized error tracking, and build dashboards for auth failures, invite acceptance failures, and rollback errors.
- **Mobile**: capture crash + handled exception telemetry, include app version and environment tags, and alert on release-specific spikes.
- **Backend/services**: emit structured logs with correlation IDs, auth action type, invite event type, and suspicious activity score. Alert on threshold breaches (e.g., OTP failures/minute, invite-spam detections, rollback denial spikes).

Recommended dashboards:

1. Auth reliability (OTP send/verify success rates, login failures, refresh failures)
2. Abuse detection (rate-limit blocks, suspicious activity score distribution)
3. Invite funnel (issued invites, accept attempts, expired/max-use failures)
4. Progress integrity (mark-read volume, rollback success/failure ratio)

## Secure deployment defaults

- **Secret management**: Store signing/encryption secrets in a managed secret store (not code/env files committed to git), with per-environment isolation.
- **HTTPS enforcement**: terminate TLS at ingress/load balancer and keep service-to-service traffic encrypted where possible. Reject non-HTTPS API base URLs in auth policy.
- **Key rotation**: rotate auth signing/encryption secrets regularly (e.g., every 90 days) with dual-key overlap windows for zero-downtime token transition.
- **Least privilege**: scope service credentials to minimum required resources.
- **Audit retention**: retain structured auth/content audit logs according to compliance policy and protect against tampering.
