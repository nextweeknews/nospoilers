export type AppEnvironment = "dev" | "stage" | "prod";

export type EnvironmentConfig = {
  apiBaseUrl: string;
  authClientId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export const DEFAULT_ENVIRONMENT: AppEnvironment = "dev";

export const ENVIRONMENT_CONFIGS: Record<AppEnvironment, EnvironmentConfig> = {
  dev: {
    apiBaseUrl: "https://api-dev.nospoilers.app",
    authClientId: "nospoilers-dev-client",
    supabaseUrl: "",
    supabaseAnonKey: ""
  },
  stage: {
    apiBaseUrl: "https://api-stage.nospoilers.app",
    authClientId: "nospoilers-stage-client",
    supabaseUrl: "",
    supabaseAnonKey: ""
  },
  prod: {
    apiBaseUrl: "https://api.nospoilers.app",
    authClientId: "nospoilers-prod-client",
    supabaseUrl: "",
    supabaseAnonKey: ""
  }
};

export const isAppEnvironment = (value: string | undefined): value is AppEnvironment =>
  value === "dev" || value === "stage" || value === "prod";
