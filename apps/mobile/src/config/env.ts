import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_CONFIGS,
  isAppEnvironment,
  type AppEnvironment,
  type EnvironmentConfig
} from "@nospoilers/types";

const rawEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

const activeEnvironment: AppEnvironment = isAppEnvironment(rawEnvironment)
  ? rawEnvironment
  : DEFAULT_ENVIRONMENT;

const defaults = ENVIRONMENT_CONFIGS[activeEnvironment];

export const mobileConfig: EnvironmentConfig & { environment: AppEnvironment } = {
  environment: activeEnvironment,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? defaults.apiBaseUrl,
  authClientId: process.env.EXPO_PUBLIC_AUTH_CLIENT_ID ?? defaults.authClientId
};
