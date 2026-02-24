import { FormEvent, type CSSProperties, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { brandPalette, elevationTokens, radiusTokens, spacingTokens, typographyTokens, type AppTheme } from "@nospoilers/ui";
import { signInWithGoogle, signInWithOtp, signInWithPassword, signUpWithPassword, verifySmsOtp } from "../services/authClient";

type CountryOption = {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "BR", dialCode: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "AR", dialCode: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "IE", dialCode: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "FR", dialCode: "+33", flag: "🇫🇷", name: "France" },
  { code: "DE", dialCode: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "IT", dialCode: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "NL", dialCode: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "BE", dialCode: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "PT", dialCode: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "CH", dialCode: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "SE", dialCode: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "NO", dialCode: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "DK", dialCode: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "FI", dialCode: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "PL", dialCode: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "CZ", dialCode: "+420", flag: "🇨🇿", name: "Czechia" },
  { code: "AT", dialCode: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "GR", dialCode: "+30", flag: "🇬🇷", name: "Greece" },
  { code: "TR", dialCode: "+90", flag: "🇹🇷", name: "Türkiye" },
  { code: "RU", dialCode: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { code: "PK", dialCode: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", dialCode: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "CN", dialCode: "+86", flag: "🇨🇳", name: "China" },
  { code: "JP", dialCode: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "KR", dialCode: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "MY", dialCode: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "TH", dialCode: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "VN", dialCode: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "PH", dialCode: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "ID", dialCode: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "NZ", dialCode: "+64", flag: "🇳🇿", name: "New Zealand" },
  { code: "AE", dialCode: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
  { code: "SA", dialCode: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "IL", dialCode: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "EG", dialCode: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "KE", dialCode: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", name: "South Africa" }
];

const detectCountryCode = () => {
  const locale = navigator.languages?.[0] ?? navigator.language;
  const countryFromLocale = locale.split("-")[1]?.toUpperCase();
  return COUNTRY_OPTIONS.some((option) => option.code === countryFromLocale) ? countryFromLocale : "US";
};

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) {
    return digits;
  }

  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const getPhoneDigits = (value: string) => value.replace(/\D/g, "").slice(0, 10);

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
      provider: identity.provider === "sms" ? "phone" : (identity.provider as "google" | "email"),
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
  const [selectedCountry, setSelectedCountry] = useState(detectCountryCode);
  const [formattedPhone, setFormattedPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter your number to start.");

  const selectedCountryOption = COUNTRY_OPTIONS.find((option) => option.code === selectedCountry) ?? COUNTRY_OPTIONS[0];
  const phoneDigits = getPhoneDigits(formattedPhone);
  const fullPhoneNumber = `${selectedCountryOption.dialCode}${phoneDigits}`;

  const handlePhoneStart = async (event: FormEvent) => {
    event.preventDefault();

    if (phoneDigits.length !== 10) {
      setStatus("Enter a valid 10-digit phone number.");
      return;
    }

    const { error } = await signInWithOtp(fullPhoneNumber);
    if (error) {
      setStatus(error.message);
      return;
    }

    setChallengeStarted(true);
    setStatus("SMS verification code sent.");
  };

  const handlePhoneVerify = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error } = await verifySmsOtp(fullPhoneNumber, smsCode);
    if (error || !data.user || !data.session) {
      setStatus(error?.message ?? "Unable to verify code.");
      return;
    }

    onSignedIn(mapResult(data.user, data.session));
  };

  const handleGoogleOAuth = async () => {
    const { error } = await signInWithGoogle();

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
            <div style={phoneInputGroup(theme)}>
              <select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)} style={countrySelectStyle(theme)} aria-label="Country code">
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={`${option.code}-${option.dialCode}`} value={option.code}>
                    {`${option.flag} ${option.name} (${option.dialCode})`}
                  </option>
                ))}
              </select>
              <input
                value={formattedPhone}
                onChange={(event) => setFormattedPhone(formatPhoneNumber(event.target.value))}
                placeholder="(555) 123-4567"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                style={phoneNumberInputStyle(theme)}
              />
            </div>
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
            const { data, error } = await signInWithPassword(email, password);
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
              const { data, error } = await signUpWithPassword(email, password);
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

const phoneInputGroup = (theme: AppTheme): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) minmax(0, 1fr)",
  gap: spacingTokens.xs,
  marginTop: 6
});

const countrySelectStyle = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.surfaceMuted,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  color: theme.colors.textPrimary,
  padding: "12px 10px",
  fontSize: typographyTokens.size.body
});

const phoneNumberInputStyle = (theme: AppTheme): CSSProperties => ({
  ...inputStyle(theme),
  marginTop: 0,
  fontVariantNumeric: "tabular-nums"
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
