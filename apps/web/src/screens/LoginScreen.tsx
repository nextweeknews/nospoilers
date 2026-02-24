import { FormEvent, type CSSProperties, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { elevationTokens, radiusTokens, spacingTokens, typographyTokens, type AppTheme } from "@nospoilers/ui";
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
  const [authView, setAuthView] = useState<"phone" | "email">("phone");
  const [selectedCountry, setSelectedCountry] = useState(detectCountryCode);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter your number to start.");

  const selectedCountryOption = COUNTRY_OPTIONS.find((option) => option.code === selectedCountry) ?? COUNTRY_OPTIONS[0];
  const sortedCountryOptions = useMemo(
    () => [selectedCountryOption, ...COUNTRY_OPTIONS.filter((option) => option.code !== selectedCountryOption.code)],
    [selectedCountryOption]
  );
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
        {authView === "phone" ? (
          <>
            <form onSubmit={handlePhoneStart} style={{ display: "grid", gap: spacingTokens.sm }}>
              <label style={{ color: theme.colors.textSecondary }}>
                Mobile number
                <div style={phoneInputGroup(theme)}>
                  <div style={countrySelectWrapper}>
                    <button type="button" onClick={() => setCountryMenuOpen((open) => !open)} style={countrySelectTrigger(theme)} aria-haspopup="listbox" aria-expanded={countryMenuOpen}>
                      <span>{selectedCountryOption.flag}</span>
                      <span>{`(${selectedCountryOption.dialCode})`}</span>
                    </button>
                    {countryMenuOpen ? (
                      <div role="listbox" style={countryMenuStyle(theme)}>
                        {sortedCountryOptions.map((option) => (
                          <button
                            key={`${option.code}-${option.dialCode}`}
                            type="button"
                            role="option"
                            aria-selected={selectedCountry === option.code}
                            onClick={() => {
                              setSelectedCountry(option.code);
                              setCountryMenuOpen(false);
                            }}
                            style={countryMenuOption(theme, option.code === selectedCountry)}
                          >
                            {`${option.flag} ${option.name} (${option.dialCode})`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                Continue with SMS
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
          </>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const { data: signInData, error: signInError } = await signInWithPassword(email, password);
              if (!signInError && signInData.user && signInData.session) {
                onSignedIn(mapResult(signInData.user, signInData.session));
                return;
              }

              const { data: signUpData, error: signUpError } = await signUpWithPassword(email, password);
              if (signUpError) {
                setStatus(signUpError.message);
                return;
              }

              if (signUpData.user && signUpData.session) {
                onSignedIn(mapResult(signUpData.user, signUpData.session));
                return;
              }

              setStatus("Check your email to finish sign up.");
            }}
            style={{ display: "grid", gap: spacingTokens.sm, marginTop: spacingTokens.xs }}
          >
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" style={inputStyle(theme)} />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" style={inputStyle(theme)} />
            <button type="submit" style={emailButton(theme)}>
              Log in or sign up
            </button>
          </form>
        )}

        <small style={{ color: theme.colors.success }}>{status}</small>
      </div>

      <footer style={{ display: "grid", gap: spacingTokens.sm }}>
        {authView === "phone" ? (
          <>
            <button type="button" id="google-signin-btn" aria-label="Sign in with Google" onClick={handleGoogleOAuth} style={googleButton(theme)}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.3 5.4-6 6.9l.1-.1 6.2 5.2C35.2 40.3 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
            <button type="button" style={emailButton(theme)} onClick={() => setAuthView("email")}>
              Continue with Email
            </button>
          </>
        ) : (
          <button type="button" style={emailButton(theme)} onClick={() => setAuthView("phone")}>
            Back to phone login
          </button>
        )}
      </footer>
    </section>
  );
};

const inputStyle = (theme: AppTheme): CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
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
  gridTemplateColumns: "minmax(112px, 132px) minmax(0, 1fr)",
  gap: spacingTokens.xs,
  marginTop: 6
});

const countrySelectWrapper: CSSProperties = {
  position: "relative",
  minWidth: 0
};

const countrySelectTrigger = (theme: AppTheme): CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  background: theme.colors.surfaceMuted,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  color: theme.colors.textPrimary,
  padding: "12px 10px",
  fontSize: typographyTokens.size.body,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacingTokens.xs
});

const countryMenuStyle = (theme: AppTheme): CSSProperties => ({
  position: "absolute",
  zIndex: 10,
  top: "calc(100% + 4px)",
  left: 0,
  width: "min(320px, 75vw)",
  maxHeight: 220,
  overflowY: "auto",
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  boxShadow: elevationTokens.medium,
  display: "grid"
});

const countryMenuOption = (theme: AppTheme, selected: boolean): CSSProperties => ({
  border: "none",
  background: selected ? theme.colors.surfaceMuted : "transparent",
  color: theme.colors.textPrimary,
  textAlign: "left",
  padding: "10px 12px",
  cursor: "pointer",
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
  borderRadius: 9999,
  padding: "12px 14px",
  fontWeight: 500,
  fontSize: typographyTokens.size.body,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  lineHeight: "20px",
  fontFamily: "Roboto, Arial, sans-serif"
};

const googleButton = (_theme: AppTheme): CSSProperties => ({
  ...socialBaseButton,
  border: "1px solid #747775",
  background: "#ffffff",
  color: "#1f1f1f"
});
