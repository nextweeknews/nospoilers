import { useEffect, useMemo, useRef, useState } from "react";
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

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const AuthCallbackScreen = ({ theme }: AuthCallbackScreenProps) => {
  const [status, setStatus] = useState<CallbackStatus>("working");
  const [errorMessage, setErrorMessage] = useState<string>();
  const hasStartedRef = useRef(false);

  const returnPath = useMemo(() => buildReturnPath(), []);

  useEffect(() => {
    let active = true;

    if (hasStartedRef.current) {
      console.log("[auth-callback] duplicate effect run skipped");
      return;
    }
    hasStartedRef.current = true;

    const handleCodeExchange = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        console.log("[auth-callback] start", {
          href: window.location.href,
          hasCode: Boolean(code),
          returnPath
        });

        if (!code) {
          if (!active) return;
          setStatus("error");
          setErrorMessage("Missing sign-in code in callback URL. Please try signing in again.");
          return;
        }

        const exchangeGuardKey = `oauth-code-exchange:${code}`;
        const exchangeGuardTsKey = `${exchangeGuardKey}:ts`;
        const currentState = sessionStorage.getItem(exchangeGuardKey);
        const currentTsRaw = sessionStorage.getItem(exchangeGuardTsKey);
        const currentTs = currentTsRaw ? Number(currentTsRaw) : 0;
        const now = Date.now();

        console.log("[auth-callback] guard state", { currentState, currentTs });

        if (currentState === "done") {
          console.log("[auth-callback] already done -> redirect");
          window.location.replace(returnPath);
          return;
        }

        if (currentState === "in-progress") {
          // Another render/tab may have started exchange. Wait briefly for it to finish.
          // IMPORTANT: do not call supabase auth methods here (they also acquire the same lock).
          const isStale = !Number.isFinite(currentTs) || now - currentTs > 15000;

          if (isStale) {
            console.warn("[auth-callback] stale in-progress guard detected; resetting");
            sessionStorage.removeItem(exchangeGuardKey);
            sessionStorage.removeItem(exchangeGuardTsKey);
          } else {
            console.log("[auth-callback] in-progress detected; waiting for completion marker");
            for (let i = 0; i < 30; i += 1) {
              if (!active) return;

              await sleep(200);

              const nextState = sessionStorage.getItem(exchangeGuardKey);
              if (nextState === "done") {
                console.log("[auth-callback] observed done marker -> redirect");
                window.location.replace(returnPath);
                return;
              }
            }

            // If no one finished, assume stale and retry ourselves.
            console.warn("[auth-callback] in-progress wait expired; resetting guard and retrying");
            sessionStorage.removeItem(exchangeGuardKey);
            sessionStorage.removeItem(exchangeGuardTsKey);
          }
        }

        // Claim the exchange.
        sessionStorage.setItem(exchangeGuardKey, "in-progress");
        sessionStorage.setItem(exchangeGuardTsKey, String(Date.now()));

        console.log("[auth-callback] exchanging code for session...");
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

        if (!active) return;

        if (error) {
          console.error("[auth-callback] exchange failed", error);
          sessionStorage.removeItem(exchangeGuardKey);
          sessionStorage.removeItem(exchangeGuardTsKey);
          setStatus("error");
          setErrorMessage(`Unable to finish sign-in: ${error.message}`);
          return;
        }

        console.log("[auth-callback] exchange succeeded -> mark done and redirect");
        sessionStorage.setItem(exchangeGuardKey, "done");
        sessionStorage.setItem(exchangeGuardTsKey, String(Date.now()));
        window.location.replace(returnPath);
      } catch (err) {
        if (!active) return;

        console.error("[auth-callback] unexpected error", err);

        const message = err instanceof Error ? err.message : "Unknown error during code exchange.";
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
          gap: spacingTokens.sm
        }}
      >
        <h1
          style={{
            margin: 0,
            color: theme.colors.textPrimary,
            fontSize: 20
          }}
        >
          Sign-in could not be completed
        </h1>

        <p style={{ margin: 0, color: theme.colors.textSecondary }}>{errorMessage}</p>

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
            cursor: "pointer"
          }}
        >
          Back to sign in
        </button>
      </section>
    );
  }

  return <p style={{ margin: 0, color: theme.colors.textSecondary }}>Finishing sign-in…</p>;
};
