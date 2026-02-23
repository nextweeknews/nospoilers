import { FormEvent, type CSSProperties, useMemo, useState } from "react";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { componentTokens, radiusTokens, spacingTokens, typographyTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";

type LoginScreenProps = {
  onSignedIn: (result: ProviderLoginResult) => void;
  theme: AppTheme;
};

export const LoginScreen = ({ onSignedIn, theme }: LoginScreenProps) => {
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string>();
  const [smsCode, setSmsCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionSummary, setSessionSummary] = useState<string>("Not signed in");

  const cardTokens = componentTokens.authCard(theme);

  const saveResult = (result: ProviderLoginResult) => {
    onSignedIn(result);
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

  const inputStyle: CSSProperties = {
    width: "100%",
    marginTop: 4,
    background: theme.colors.surfaceMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: radiusTokens.sm,
    color: theme.colors.textPrimary,
    padding: "10px 12px"
  };

  const primaryButtonStyle: CSSProperties = {
    background: theme.colors.accent,
    color: theme.colors.accentText,
    border: "none",
    borderRadius: radiusTokens.sm,
    padding: "10px 12px",
    fontWeight: Number(typographyTokens.weight.semibold),
    cursor: "pointer"
  };

  return (
    <section style={{ background: cardTokens.background, border: `1px solid ${cardTokens.borderColor}`, borderRadius: radiusTokens.lg, padding: 20, color: theme.colors.textPrimary, display: "grid", gap: spacingTokens.md }}>
      <h2 style={{ margin: 0 }}>Sign in to NoSpoilers</h2>
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>Phone and social sign-in are primary. Email/password is available as fallback.</p>

      <form onSubmit={handlePhoneStart} style={{ display: "grid", gap: spacingTokens.sm }}>
        <label>
          Phone number
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 123 9876" style={inputStyle} />
        </label>
        <button type="submit" style={primaryButtonStyle}>Send SMS code</button>
      </form>

      {challengeId ? (
        <form onSubmit={handlePhoneVerify} style={{ display: "grid", gap: spacingTokens.sm }}>
          <label>
            One-time code
            <input value={smsCode} onChange={(event) => setSmsCode(event.target.value)} placeholder="6-digit code" style={inputStyle} />
          </label>
          <button type="submit" style={primaryButtonStyle}>Verify code</button>
          <small style={{ color: theme.colors.accent }}>Dev code: {devCode}</small>
        </form>
      ) : null}

      <div style={{ display: "grid", gap: spacingTokens.sm }}>
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
        style={{ display: "grid", gap: spacingTokens.sm, opacity: 0.8, borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.md }}
      >
        <strong style={{ fontSize: typographyTokens.size.caption, color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 }}>Fallback: email/password</strong>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle} />
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" style={inputStyle} />
        <button type="submit" style={{ ...primaryButtonStyle, background: theme.colors.surfaceMuted, color: theme.colors.textPrimary }}>Sign in with email</button>
      </form>

      <small style={{ color: theme.colors.success }}>{sessionSummary}</small>
    </section>
  );
};
