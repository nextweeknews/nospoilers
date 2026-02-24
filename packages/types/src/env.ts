export type AppEnvironment = "dev" | "stage" | "prod";

const SUPABASE_URL = "https://zwnacudkxhyekcleqoun.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BrK-zYWpEfZZlClVi3tAZA_jh-_0WKP";

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
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  },
  stage: {
    apiBaseUrl: "https://api-stage.nospoilers.app",
    authClientId: "nospoilers-stage-client",
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  },
  prod: {
    apiBaseUrl: "https://api.nospoilers.app",
    authClientId: "nospoilers-prod-client",
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  }
};

export const isAppEnvironment = (value: string | undefined): value is AppEnvironment =>
  value === "dev" || value === "stage" || value === "prod";
