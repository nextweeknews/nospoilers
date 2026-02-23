import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_CONFIGS,
  isAppEnvironment,
  type AppEnvironment,
  type EnvironmentConfig
} from "@nospoilers/types";

const rawEnvironment = import.meta.env?.VITE_APP_ENV;

const activeEnvironment: AppEnvironment = isAppEnvironment(rawEnvironment)
  ? rawEnvironment
  : DEFAULT_ENVIRONMENT;

const defaults = ENVIRONMENT_CONFIGS[activeEnvironment];

export const webConfig: EnvironmentConfig & { environment: AppEnvironment } = {
  environment: activeEnvironment,
  apiBaseUrl: import.meta.env?.VITE_API_URL ?? defaults.apiBaseUrl,
  authClientId: import.meta.env?.VITE_AUTH_CLIENT_ID ?? defaults.authClientId
};
