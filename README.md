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
