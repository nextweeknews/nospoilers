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
