import { useEffect, useMemo, useState } from "react";
import { spacingTokens, type AppTheme } from "@nospoilers/ui";
import { supabaseClient } from "../services/supabaseClient";

type AuthCallbackScreenProps = {
  theme: AppTheme;
};

type CallbackStatus = "working" | "error";

const getSafeNextPath = (value: string | null): string | null => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
};

const buildReturnPath = (): string => {
  const searchParams = new URLSearchParams(window.location.search);
  const nextPath = getSafeNextPath(searchParams.get("next"));

  if (nextPath) {
    return nextPath;
  }

  const callbackType = searchParams.get("type");
  return callbackType ? `/?type=${encodeURIComponent(callbackType)}` : "/";
};

export const AuthCallbackScreen = ({ theme }: AuthCallbackScreenProps) => {
  const [status, setStatus] = useState<CallbackStatus>("working");
  const [errorMessage, setErrorMessage] = useState<string>();

  const returnPath = useMemo(() => buildReturnPath(), []);

  useEffect(() => {
    let active = true;

    const handleCodeExchange = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData.session) {
        window.location.replace(returnPath);
        return;
      }

      if (!code) {
        setStatus("error");
        setErrorMessage("Missing sign-in code in callback URL. Please try signing in again.");
        return;
      }

      const exchangeGuardKey = `oauth-code-exchange:${code}`;
      const currentState = sessionStorage.getItem(exchangeGuardKey);

      if (currentState === "done") {
        window.location.replace(returnPath);
        return;
      }

      if (currentState === "in-progress") {
        // Another invocation may already be exchanging the code (e.g. React Strict Mode).
        // If no session exists yet, clear stale state and retry this exchange.
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
          sessionStorage.setItem(exchangeGuardKey, "done");
          window.location.replace(returnPath);
          return;
        }

        sessionStorage.removeItem(exchangeGuardKey);
      }

      sessionStorage.setItem(exchangeGuardKey, "in-progress");

      try {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

        if (!active) return;

        if (error) {
          sessionStorage.removeItem(exchangeGuardKey);
          setStatus("error");
          setErrorMessage(`Unable to finish sign-in: ${error.message}`);
          return;
        }

        sessionStorage.setItem(exchangeGuardKey, "done");
        window.location.replace(returnPath);
      } catch (err) {
        if (!active) return;

        sessionStorage.removeItem(exchangeGuardKey);

        const message =
          err instanceof Error ? err.message : "Unknown error during code exchange.";

        setStatus("error");
        setErrorMessage(`Unable to finish sign-in: ${message}`);
      }
    };

    void handleCodeExchange();

    return () => {
      active = false;
    };
  }, [returnPath]);

  if (status === "error") {
    return (
      <section
        style={{
          width: "min(420px, 100%)",
          padding: spacingTokens.lg,
          display: "grid",
          gap: spacingTokens.sm,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: theme.colors.textPrimary,
            fontSize: 20,
          }}
        >
          Sign-in could not be completed
        </h1>

        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() => window.location.assign("/")}
          style={{
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            background: theme.colors.accent,
            color: theme.colors.accentText,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <p style={{ margin: 0, color: theme.colors.textSecondary }}>
      Finishing sign-in…
    </p>
  );
};
