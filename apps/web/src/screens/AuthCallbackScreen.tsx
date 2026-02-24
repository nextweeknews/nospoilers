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

    // React StrictMode (dev) can run effects twice. This prevents duplicate callback handling.
    if (hasStartedRef.current) {
      console.log("[auth-callback] duplicate effect run skipped");
      return;
    }
    hasStartedRef.current = true;

    const handleCodeExchange = async () => {
      try {
        console.log("[auth-callback] start", {
          href: window.location.href,
          returnPath
        });

        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        console.log("[auth-callback] parsed callback params", {
          hasCode: Boolean(code),
          type: searchParams.get("type"),
          next: searchParams.get("next")
        });

        if (!code) {
          if (!active) return;
          setStatus("error");
          setErrorMessage("Missing sign-in code in callback URL. Please try signing in again.");
          return;
        }

        const exchangeGuardKey = `oauth-code-exchange:${code}`;
        const currentState = sessionStorage.getItem(exchangeGuardKey);

        console.log("[auth-callback] exchange guard state", {
          exchangeGuardKey,
          currentState
        });

        if (currentState === "done") {
          console.log("[auth-callback] code already exchanged; redirecting");
          window.location.replace(returnPath);
          return;
        }

        if (currentState === "in-progress") {
          console.log("[auth-callback] exchange already in progress; waiting for session");

          // Another invocation/tab may be doing the exchange.
          // Poll briefly for the session instead of returning immediately and getting stuck.
          for (let i = 0; i < 20; i += 1) {
            if (!active) return;

            const { data, error } = await supabaseClient.auth.getSession();
            if (error) {
              console.warn("[auth-callback] getSession during in-progress wait failed", error);
            }

            if (data.session) {
              console.log("[auth-callback] session detected during in-progress wait; redirecting");
              sessionStorage.setItem(exchangeGuardKey, "done");
              window.location.replace(returnPath);
              return;
            }

            await sleep(150);
          }

          // Timed out waiting. Reset guard so this page can attempt the exchange itself.
          console.warn("[auth-callback] timed out waiting for in-progress exchange; resetting guard and retrying");
          sessionStorage.removeItem(exchangeGuardKey);
        }

        // Before exchanging, check whether a session already exists (e.g., another handler completed).
        {
          const { data, error } = await supabaseClient.auth.getSession();
          if (error) {
            console.warn("[auth-callback] pre-exchange getSession failed", error);
          }

          if (data.session) {
            console.log("[auth-callback] session already present before exchange; marking done and redirecting");
            sessionStorage.setItem(exchangeGuardKey, "done");
            window.location.replace(returnPath);
            return;
          }
        }

        sessionStorage.setItem(exchangeGuardKey, "in-progress");
        console.log("[auth-callback] exchanging code for session...");

        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

        if (!active) return;

        if (error) {
          console.error("[auth-callback] exchange failed", error);
          sessionStorage.removeItem(exchangeGuardKey);
          setStatus("error");
          setErrorMessage(`Unable to finish sign-in: ${error.message}`);
          return;
        }

        console.log("[auth-callback] exchange succeeded");
        sessionStorage.setItem(exchangeGuardKey, "done");

        // Confirm session exists before redirecting (helps catch odd edge cases)
        const { data: finalSessionData, error: finalSessionError } = await supabaseClient.auth.getSession();
        if (finalSessionError) {
          console.warn("[auth-callback] post-exchange getSession warning", finalSessionError);
        }

        console.log("[auth-callback] post-exchange session", {
          hasSession: Boolean(finalSessionData.session),
          userId: finalSessionData.session?.user?.id ?? null
        });

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
