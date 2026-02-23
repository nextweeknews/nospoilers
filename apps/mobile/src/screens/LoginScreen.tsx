import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { mobileConfig } from "../config/env";

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY for mobile auth flows.");
}

const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    storage: AsyncStorage as unknown as Storage
  }
});

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
  const fallbackRedirectTo = Linking.createURL("auth/callback", {
    scheme: mobileConfig.supabaseAuthDeepLinkScheme
  });
  const redirectTo = mobileConfig.supabaseAuthRedirectUrl ?? fallbackRedirectTo;

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not signed in");

  const saveResult = (result: ProviderLoginResult) => {
    onSignedIn(result);
    setStatus(`Signed in via ${result.user.identities.map((identity) => identity.provider).join(", ")}`);
  };

  const handleOAuth = async (provider: "google") => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error || !data.url) {
      setStatus(error?.message ?? "Unable to start OAuth flow.");
      return;
    }

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (authResult.type !== "success" || !authResult.url) {
      setStatus("OAuth sign-in cancelled.");
      return;
    }

    const { params } = Linking.parse(authResult.url);
    const accessToken = typeof params.access_token === "string" ? params.access_token : undefined;
    const refreshToken = typeof params.refresh_token === "string" ? params.refresh_token : undefined;

    if (!accessToken || !refreshToken) {
      setStatus("Missing session tokens from OAuth callback.");
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (sessionError || !sessionData.session || !sessionData.user) {
      setStatus(sessionError?.message ?? "Unable to finalize OAuth login.");
      return;
    }

    saveResult(mapResult(sessionData.user, sessionData.session));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Sign in</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Phone + social first. Email/password is fallback.</Text>

      <TextInput placeholder="Phone number" placeholderTextColor={theme.colors.textSecondary} value={phone} onChangeText={setPhone} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (error) {
            setStatus(error.message);
            return;
          }

          setChallengeStarted(true);
          setStatus("SMS verification code sent.");
        }}
      >
        <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Send SMS code</Text>
      </Pressable>

      {challengeStarted ? (
        <>
          <TextInput placeholder="One-time code" placeholderTextColor={theme.colors.textSecondary} value={code} onChangeText={setCode} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={async () => {
              const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
              if (error || !data.user || !data.session) {
                setStatus(error?.message ?? "Unable to verify code.");
                return;
              }

              saveResult(mapResult(data.user, data.session));
            }}
          >
            <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Verify code</Text>
          </Pressable>
        </>
      ) : null}

      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          await handleOAuth("google");
        }}
      >
        <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Continue with Google</Text>
      </Pressable>

      <View style={[styles.fallbackSection, { borderTopColor: theme.colors.border }]}> 
        <Text style={[styles.fallbackLabel, { color: theme.colors.textSecondary }]}>Fallback: email/password</Text>
        <TextInput placeholder="Email" placeholderTextColor={theme.colors.textSecondary} value={email} onChangeText={setEmail} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
        />
        <Pressable
          style={[styles.secondaryButton, { backgroundColor: theme.colors.surfaceMuted }]}
          onPress={async () => {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data.user || !data.session) {
              setStatus(error?.message ?? "Unable to sign in with email.");
              return;
            }

            saveResult(mapResult(data.user, data.session));
          }}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Sign in with email</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { backgroundColor: theme.colors.surfaceMuted }]}
          onPress={async () => {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) {
              setStatus(error.message);
              return;
            }

            if (data.user && data.session) {
              saveResult(mapResult(data.user, data.session));
              return;
            }

            setStatus("Check your email to finish sign up.");
          }}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Sign up with email</Text>
        </Pressable>
      </View>

      <Text style={[styles.status, { color: theme.colors.success }]}>{status}</Text>
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
  status: { marginTop: 4 }
});
