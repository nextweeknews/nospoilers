import { FormEvent, type CSSProperties, useMemo, useState } from "react";
import type { ProviderLoginResult } from "@nospoilers/auth";
import { AuthService, InMemoryEncryptedStorage, InMemorySecureTokenStore } from "@nospoilers/auth";
import { webConfig } from "../config/env";

const authService = new AuthService(
  new InMemoryEncryptedStorage(),
  new InMemorySecureTokenStore(),
  "web-demo-encryption-key",
  {
    accessTokenTtlMs: 15 * 60 * 1000,
    refreshTokenTtlMs: 14 * 24 * 60 * 60 * 1000,
    smsCodeTtlMs: 5 * 60 * 1000,
    passwordSalt: "nospoilers-salt",
    transport: {
      apiBaseUrl: webConfig.apiBaseUrl,
      cookieName: "ns_refresh",
      platform: "web",
      enforceSecureStorage: true
    }
  }
);

export const LoginScreen = () => {
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string>();
  const [smsCode, setSmsCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionSummary, setSessionSummary] = useState<string>("Not signed in");

  const saveResult = (result: ProviderLoginResult) => {
    setSessionSummary(
      `Signed in as ${result.user.id} via ${result.user.identities.map((identity) => identity.provider).join(", ")} · token ${result.session.accessToken.slice(0, 14)}...`
    );
  };

  const handlePhoneStart = async (event: FormEvent) => {
    event.preventDefault();
    const challenge = await authService.startPhoneLogin(phone);
    setChallengeId(challenge.challengeId);
    setDevCode(challenge.deliveryCodeForDevOnly);
  };

  const handlePhoneVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    const result = await authService.verifyPhoneCode(challengeId, smsCode);
    saveResult(result);
  };

  const oauthButtons = useMemo(
    () => [
      { provider: "google" as const, label: "Continue with Google" },
      { provider: "apple" as const, label: "Continue with Apple" }
    ],
    []
  );

  return (
    <section style={{ background: "#111827", borderRadius: 16, padding: 20, color: "#f8fafc", display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Sign in to NoSpoilers</h2>
      <p style={{ margin: 0, color: "#cbd5e1" }}>Phone and social sign-in are primary. Email/password is available as fallback.</p>

      <form onSubmit={handlePhoneStart} style={{ display: "grid", gap: 8 }}>
        <label>
          Phone number
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 123 9876" style={inputStyle} />
        </label>
        <button type="submit" style={primaryButtonStyle}>Send SMS code</button>
      </form>

      {challengeId ? (
        <form onSubmit={handlePhoneVerify} style={{ display: "grid", gap: 8 }}>
          <label>
            One-time code
            <input value={smsCode} onChange={(event) => setSmsCode(event.target.value)} placeholder="6-digit code" style={inputStyle} />
          </label>
          <button type="submit" style={primaryButtonStyle}>Verify code</button>
          <small style={{ color: "#93c5fd" }}>Dev code: {devCode}</small>
        </form>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {oauthButtons.map((button) => (
          <button
            key={button.provider}
            style={primaryButtonStyle}
            onClick={async () => {
              const result = await authService.loginWithOAuth(button.provider, `${button.provider}-demo-user`, "reader@example.com");
              saveResult(result);
            }}
          >
            {button.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await authService.loginWithEmailPassword(email, password);
          saveResult(result);
        }}
        style={{ display: "grid", gap: 8, opacity: 0.7, borderTop: "1px solid #334155", paddingTop: 12 }}
      >
        <strong style={{ fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>Fallback: email/password</strong>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle} />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          style={inputStyle}
        />
        <button type="submit" style={secondaryButtonStyle}>Sign in with email</button>
      </form>

      <small style={{ color: "#a7f3d0" }}>{sessionSummary}</small>
    </section>
  );
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  background: "#1f2937",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f8fafc",
  padding: "10px 12px"
};

const primaryButtonStyle: CSSProperties = {
  background: "#2563eb",
  color: "#eff6ff",
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: 600,
  cursor: "pointer"
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#1e293b",
  color: "#cbd5e1"
};
