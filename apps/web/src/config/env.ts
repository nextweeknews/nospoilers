import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_CONFIGS,
  isAppEnvironment,
  type AppEnvironment,
  type EnvironmentConfig
} from "@nospoilers/types";

const readViteEnv = (key: string): string | undefined => {
  const importMeta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  return importMeta.env?.[key];
};

const rawEnvironment = readViteEnv("VITE_APP_ENV");

const activeEnvironment: AppEnvironment = isAppEnvironment(rawEnvironment)
  ? rawEnvironment
  : DEFAULT_ENVIRONMENT;

const defaults = ENVIRONMENT_CONFIGS[activeEnvironment];

export const webConfig: EnvironmentConfig & { environment: AppEnvironment } = {
  environment: activeEnvironment,
  apiBaseUrl: readViteEnv("VITE_API_URL") ?? defaults.apiBaseUrl,
  authClientId: readViteEnv("VITE_AUTH_CLIENT_ID") ?? defaults.authClientId
};
