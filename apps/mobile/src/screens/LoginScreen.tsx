import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import {
  authRedirectTo,
  completeOAuthSession,
  getSession,
  onAuthStateChange,
  requestPasswordReset,
  signInWithGoogle,
  signInWithOtp,
  signInWithPassword,
  signUpWithPassword,
  updateCurrentUserPassword,
  verifySmsOtp
} from "../services/authClient";
import { AppText, AppTextInput } from "../components/Typography";

WebBrowser.maybeCompleteAuthSession();

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

type StatusTone = "info" | "success" | "error";

type LoginStatus = {
  message: string;
  tone: StatusTone;
};

const STATUS_TONE_COLORS: Record<StatusTone, string> = {
  info: "#475569",
  success: "#166534",
  error: "#b91c1c"
};

const TERMS_URL = "https://nospoilers.app/terms";
const PRIVACY_POLICY_URL = "https://nospoilers.app/privacy-policy";

const callbackIndicatesRecovery = (url: string): boolean => {
  const parsed = Linking.parse(url);
  const params = ("params" in parsed && parsed.params ? parsed.params : {}) as Record<string, unknown>;
  const queryType = typeof params.type === "string" ? params.type : undefined;
  const fragment = url.includes("#") ? url.split("#")[1] ?? "" : "";
  const fragmentType = new URLSearchParams(fragment).get("type") ?? undefined;
  return queryType === "recovery" || fragmentType === "recovery";
};

export const LoginScreen = ({ onSignedIn, theme }: LoginScreenProps) => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>({ message: "Enter your number to start.", tone: "info" });
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);

  const saveResult = (result: ProviderLoginResult) => {
    onSignedIn(result);
    setStatus({ message: `Signed in via ${result.user.identities.map((identity) => identity.provider).join(", ")}`, tone: "success" });
  };

  useEffect(() => {
    const handleResetCallback = async (url: string) => {
      if (!callbackIndicatesRecovery(url)) {
        return;
      }

      const { error } = await completeOAuthSession(url);
      if (error) {
        setStatus({ message: `Password reset link could not be completed. ${error.message}`, tone: "error" });
        return;
      }

      setIsPasswordResetMode(true);
      setStatus({ message: "Enter a new password to finish resetting your password.", tone: "info" });
    };

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleResetCallback(url);
      }
    });

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void handleResetCallback(url);
    });

    const { data: authListener } = onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordResetMode(true);
        setStatus({ message: "Enter a new password to finish resetting your password.", tone: "info" });
      }
    });

    return () => {
      linkSub.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleOAuth = async () => {
    const { data, error } = await signInWithGoogle();

    if (error || !data.url) {
      setStatus({ message: error?.message ?? "Unable to start OAuth flow.", tone: "error" });
      return;
    }

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo);
    if (authResult.type !== "success" || !authResult.url) {
      setStatus({ message: "OAuth sign-in cancelled.", tone: "info" });
      return;
    }

    const { data: sessionData, error: sessionError } = await completeOAuthSession(authResult.url);

    if (sessionError || !sessionData.session || !sessionData.user) {
      setStatus({ message: sessionError?.message ?? "Unable to finalize OAuth login.", tone: "error" });
      return;
    }

    saveResult(mapResult(sessionData.user, sessionData.session));
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setStatus({ message: "Enter your email, then tap Forgot password?.", tone: "error" });
      return;
    }

    const { error } = await requestPasswordReset(email.trim());
    if (error) {
      setStatus({ message: `Unable to send reset email. ${error.message}`, tone: "error" });
      return;
    }

    setStatus({ message: "If an account exists for that email, check your email for password reset instructions.", tone: "success" });
  };

  const handleCompletePasswordReset = async () => {
    if (newPassword.length < 8) {
      setStatus({ message: "Use at least 8 characters for your new password.", tone: "error" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatus({ message: "New passwords do not match.", tone: "error" });
      return;
    }

    const { error } = await updateCurrentUserPassword(newPassword);
    if (error) {
      setStatus({ message: `Unable to update password. ${error.message}`, tone: "error" });
      return;
    }

    const { data, error: sessionError } = await getSession();
    if (sessionError || !data.session?.user) {
      setIsPasswordResetMode(false);
      setStatus({ message: "Password updated. Sign in with your new password.", tone: "success" });
      return;
    }

    saveResult(mapResult(data.session.user, data.session));
  };

  const handleOpenLegalLink = async (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      setStatus({ message: "Unable to open link right now.", tone: "error" });
      return;
    }

    await Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>Sign in</AppText>
      <AppText style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Phone + social first. Email/password is fallback.</AppText>

      <AppTextInput placeholder="Phone number" placeholderTextColor={theme.colors.textSecondary} value={phone} onChangeText={setPhone} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const { error } = await signInWithOtp(phone);
          if (error) {
            setStatus({ message: error.message, tone: "error" });
            return;
          }

          setChallengeStarted(true);
          setStatus({ message: "SMS verification code sent.", tone: "success" });
        }}
      >
        <AppText style={[styles.primaryText, { color: theme.colors.accentText }]}>Send SMS code</AppText>
      </Pressable>

      {challengeStarted ? (
        <>
          <AppTextInput placeholder="One-time code" placeholderTextColor={theme.colors.textSecondary} value={code} onChangeText={setCode} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={async () => {
              const { data, error } = await verifySmsOtp(phone, code);
              if (error || !data.user || !data.session) {
                setStatus({ message: error?.message ?? "Unable to verify code.", tone: "error" });
                return;
              }

              saveResult(mapResult(data.user, data.session));
            }}
          >
            <AppText style={[styles.primaryText, { color: theme.colors.accentText }]}>Verify code</AppText>
          </Pressable>
        </>
      ) : null}

      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          await handleOAuth();
        }}
      >
        <AppText style={[styles.primaryText, { color: theme.colors.accentText }]}>Continue with Google</AppText>
      </Pressable>
      <AppText style={[styles.legalText, { color: theme.colors.textSecondary }]}> 
        By continuing, you agree to{" "}
        <AppText style={[styles.legalLink, { color: theme.colors.accent }]} onPress={() => void handleOpenLegalLink(TERMS_URL)}>
          Terms
        </AppText>{" "}
        and{" "}
        <AppText style={[styles.legalLink, { color: theme.colors.accent }]} onPress={() => void handleOpenLegalLink(PRIVACY_POLICY_URL)}>
          Privacy Policy
        </AppText>
        .
      </AppText>

      <View style={[styles.fallbackSection, { borderTopColor: theme.colors.border }]}> 
        <AppText style={[styles.fallbackLabel, { color: theme.colors.textSecondary }]}>Fallback: email/password</AppText>
        <AppTextInput placeholder="Email" placeholderTextColor={theme.colors.textSecondary} value={email} onChangeText={setEmail} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        {isPasswordResetMode ? (
          <>
            <AppTextInput
              placeholder="New password"
              placeholderTextColor={theme.colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
            />
            <AppTextInput
              placeholder="Confirm new password"
              placeholderTextColor={theme.colors.textSecondary}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
            />
            <Pressable style={[styles.secondaryButton, { backgroundColor: theme.colors.surfaceMuted }]} onPress={handleCompletePasswordReset}>
              <AppText style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Set new password</AppText>
            </Pressable>
          </>
        ) : (
          <>
            <AppTextInput
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
            />
            <Pressable onPress={handleForgotPassword}>
              <AppText style={[styles.link, { color: theme.colors.accent }]}>Forgot password?</AppText>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.colors.surfaceMuted }]}
              onPress={async () => {
                const { data, error } = await signInWithPassword(email, password);
                if (error || !data.user || !data.session) {
                  setStatus({ message: error?.message ?? "Unable to sign in with email.", tone: "error" });
                  return;
                }

                saveResult(mapResult(data.user, data.session));
              }}
            >
              <AppText style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Sign in with email</AppText>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.colors.surfaceMuted }]}
              onPress={async () => {
                const { data, error } = await signUpWithPassword(email, password);
                if (error) {
                  setStatus({ message: error.message, tone: "error" });
                  return;
                }

                if (data.user && data.session) {
                  saveResult(mapResult(data.user, data.session));
                  return;
                }

                setStatus({ message: "Check your email to finish sign up.", tone: "success" });
              }}
            >
              <AppText style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Sign up with email</AppText>
            </Pressable>
            <AppText style={[styles.legalText, { color: theme.colors.textSecondary }]}> 
              By continuing, you agree to{" "}
              <AppText style={[styles.legalLink, { color: theme.colors.accent }]} onPress={() => void handleOpenLegalLink(TERMS_URL)}>
                Terms
              </AppText>{" "}
              and{" "}
              <AppText style={[styles.legalLink, { color: theme.colors.accent }]} onPress={() => void handleOpenLegalLink(PRIVACY_POLICY_URL)}>
                Privacy Policy
              </AppText>
              .
            </AppText>
          </>
        )}
      </View>

      <AppText style={[styles.status, { color: STATUS_TONE_COLORS[status.tone] }]}>{status.message}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.lg, gap: spacingTokens.sm },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: {},
  input: {
    borderWidth: 1,
    borderRadius: radiusTokens.sm,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  primaryButton: { borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  primaryText: { fontWeight: "600" },
  fallbackSection: { marginTop: 8, borderTopWidth: 1, paddingTop: 10, opacity: 0.8, gap: 8 },
  fallbackLabel: { textTransform: "uppercase", fontSize: 12, letterSpacing: 0.8 },
  secondaryButton: { borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  secondaryText: { fontWeight: "600" },
  link: { fontWeight: "600" },
  legalText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  legalLink: { fontWeight: "600" },
  status: { marginTop: 4 }
});
