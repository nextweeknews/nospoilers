import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_CONFIGS,
  isAppEnvironment,
  type AppEnvironment,
  type EnvironmentConfig
} from "@nospoilers/types";

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

const rawEnvironment = env.VITE_APP_ENV;

const activeEnvironment: AppEnvironment = isAppEnvironment(rawEnvironment)
  ? rawEnvironment
  : DEFAULT_ENVIRONMENT;

const defaults = ENVIRONMENT_CONFIGS[activeEnvironment];

export const webConfig: EnvironmentConfig & { environment: AppEnvironment } = {
  environment: activeEnvironment,
  apiBaseUrl: env.VITE_API_URL ?? defaults.apiBaseUrl,
  authClientId: env.VITE_AUTH_CLIENT_ID ?? defaults.authClientId
};
