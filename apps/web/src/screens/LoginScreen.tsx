import { FormEvent, type CSSProperties, useState } from "react";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { brandPalette, elevationTokens, radiusTokens, spacingTokens, typographyTokens, type AppTheme } from "@nospoilers/ui";
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
  const [status, setStatus] = useState("Enter your number to start.");

  const handlePhoneStart = async (event: FormEvent) => {
    event.preventDefault();
    const challenge = await authService.startPhoneLogin(phone);
    setChallengeId(challenge.challengeId);
    setDevCode(challenge.deliveryCodeForDevOnly);
    setStatus("SMS verification code sent through Twilio Verify.");
  };

  const handlePhoneVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    const result = await authService.verifyPhoneCode(challengeId, smsCode);
    onSignedIn(result);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const result = await authService.loginWithOAuth(provider, `${provider}-demo-user`, "reader@example.com");
    onSignedIn(result);
  };

  return (
    <section
      style={{
        width: "min(430px, 100%)",
        minHeight: "min(860px, 100vh - 24px)",
        background: theme.colors.surface,
        borderRadius: 28,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: elevationTokens.medium,
        padding: spacingTokens.xl,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: spacingTokens.lg
      }}
    >
      <header style={{ textAlign: "center", display: "grid", gap: spacingTokens.sm }}>
        <div style={{ margin: "0 auto", width: 62, height: 62, borderRadius: 18, background: theme.colors.accent, color: theme.colors.accentText, display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700 }}>
          N
        </div>
        <h1 style={{ margin: 0, color: theme.colors.textPrimary }}>NoSpoilers</h1>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Sign in to join your spoiler-safe feed</p>
      </header>

      <div style={{ display: "grid", alignContent: "center", gap: spacingTokens.md }}>
        <form onSubmit={handlePhoneStart} style={{ display: "grid", gap: spacingTokens.sm }}>
          <label style={{ color: theme.colors.textSecondary }}>
            Mobile number
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 123 9876" style={inputStyle(theme)} />
          </label>
          <button type="submit" style={smsButton(theme)}>
            Send SMS code
          </button>
        </form>

        {challengeId ? (
          <form onSubmit={handlePhoneVerify} style={{ display: "grid", gap: spacingTokens.sm }}>
            <label style={{ color: theme.colors.textSecondary }}>
              Verification code
              <input value={smsCode} onChange={(event) => setSmsCode(event.target.value)} placeholder="6-digit code" style={inputStyle(theme)} />
            </label>
            <button type="submit" style={smsButton(theme)}>
              Verify and continue
            </button>
            <small style={{ color: theme.colors.accentStrong }}>Dev code: {devCode}</small>
          </form>
        ) : null}

        <small style={{ color: theme.colors.success }}>{status}</small>
      </div>

      <footer style={{ display: "grid", gap: spacingTokens.sm }}>
        <button type="button" onClick={() => handleOAuth("google")} style={googleButton}>
          Continue with Google
        </button>
        <button type="button" onClick={() => handleOAuth("apple")} style={appleButton}>
          Continue with Apple
        </button>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await authService.loginWithEmailPassword(email, password);
            onSignedIn(result);
          }}
          style={{ display: "grid", gap: spacingTokens.sm, marginTop: spacingTokens.xs }}
        >
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" style={inputStyle(theme)} />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" style={inputStyle(theme)} />
          <button type="submit" style={emailButton(theme)}>
            Continue with Email
          </button>
        </form>
      </footer>
    </section>
  );
};

const inputStyle = (theme: AppTheme): CSSProperties => ({
  width: "100%",
  marginTop: 6,
  background: theme.colors.surfaceMuted,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  color: theme.colors.textPrimary,
  padding: "12px 14px",
  fontSize: typographyTokens.size.body
});

const smsButton = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.accent,
  color: theme.colors.accentText,
  border: "none",
  borderRadius: radiusTokens.md,
  padding: "12px 14px",
  fontWeight: Number(typographyTokens.weight.semibold),
  cursor: "pointer",
  width: "min(360px, 100%)",
  justifySelf: "center"
});

const emailButton = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.surfaceMuted,
  border: `1px solid ${theme.colors.border}`,
  color: theme.colors.textPrimary,
  borderRadius: radiusTokens.md,
  padding: "12px 14px",
  fontWeight: Number(typographyTokens.weight.semibold),
  cursor: "pointer",
  width: "min(360px, 100%)",
  justifySelf: "center"
});

const socialBaseButton: CSSProperties = {
  width: "min(360px, 100%)",
  justifySelf: "center",
  borderRadius: radiusTokens.md,
  padding: "12px 14px",
  fontWeight: Number(typographyTokens.weight.semibold),
  fontSize: typographyTokens.size.body,
  cursor: "pointer"
};

const googleButton: CSSProperties = {
  ...socialBaseButton,
  border: `1px solid ${brandPalette.slate[300]}`,
  background: "#ffffff",
  color: "#202124"
};

const appleButton: CSSProperties = {
  ...socialBaseButton,
  border: "1px solid #000000",
  background: "#000000",
  color: "#ffffff"
};
