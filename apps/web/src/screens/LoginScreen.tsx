import { FormEvent, type CSSProperties, useState } from "react";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { brandPalette, elevationTokens, radiusTokens, spacingTokens, typographyTokens, type AppTheme } from "@nospoilers/ui";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for web auth flows.");
}

const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

const mapResult = (user: User, session: Session): ProviderLoginResult => ({
  linked: false,
  session: {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: "Bearer",
    expiresInMs: (session.expires_in ?? 0) * 1000
  },
  user: {
    id: user.id,
    email: user.email,
    primaryPhone: user.phone,
    identities: (user.identities ?? []).map((identity) => ({
      provider: identity.provider === "sms" ? "phone" : (identity.provider as "google" | "apple" | "email"),
      subject: identity.identity_id,
      verified: Boolean(identity.last_sign_in_at)
    })),
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? user.created_at,
    displayName: (user.user_metadata.full_name as string | undefined) ?? (user.user_metadata.name as string | undefined),
    avatarUrl: user.user_metadata.avatar_url as string | undefined
  }
});

type LoginScreenProps = {
  onSignedIn: (result: ProviderLoginResult) => void;
  theme: AppTheme;
};

export const LoginScreen = ({ onSignedIn, theme }: LoginScreenProps) => {
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter your number to start.");

  const handlePhoneStart = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      setStatus(error.message);
      return;
    }

    setChallengeStarted(true);
    setStatus("SMS verification code sent.");
  };

  const handlePhoneVerify = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: smsCode, type: "sms" });
    if (error || !data.user || !data.session) {
      setStatus(error?.message ?? "Unable to verify code.");
      return;
    }

    onSignedIn(mapResult(data.user, data.session));
  };

  const handleGoogleOAuth = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Redirecting to Google sign-in...");
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

        {challengeStarted ? (
          <form onSubmit={handlePhoneVerify} style={{ display: "grid", gap: spacingTokens.sm }}>
            <label style={{ color: theme.colors.textSecondary }}>
              Verification code
              <input value={smsCode} onChange={(event) => setSmsCode(event.target.value)} placeholder="6-digit code" style={inputStyle(theme)} />
            </label>
            <button type="submit" style={smsButton(theme)}>
              Verify and continue
            </button>
          </form>
        ) : null}

        <small style={{ color: theme.colors.success }}>{status}</small>
      </div>

      <footer style={{ display: "grid", gap: spacingTokens.sm }}>
        <button type="button" onClick={handleGoogleOAuth} style={googleButton}>
          Continue with Google
        </button>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data.user || !data.session) {
              setStatus(error?.message ?? "Unable to sign in with email.");
              return;
            }

            onSignedIn(mapResult(data.user, data.session));
          }}
          style={{ display: "grid", gap: spacingTokens.sm, marginTop: spacingTokens.xs }}
        >
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" style={inputStyle(theme)} />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" style={inputStyle(theme)} />
          <button type="submit" style={emailButton(theme)}>
            Continue with Email
          </button>
          <button
            type="button"
            onClick={async () => {
              const { data, error } = await supabase.auth.signUp({ email, password });
              if (error) {
                setStatus(error.message);
                return;
              }

              if (data.user && data.session) {
                onSignedIn(mapResult(data.user, data.session));
                return;
              }

              setStatus("Check your email to finish sign up.");
            }}
            style={emailButton(theme)}
          >
            Sign up with Email
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
