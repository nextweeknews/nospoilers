import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ProviderLoginResult } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";

type LoginScreenProps = {
  onSignedIn: (result: ProviderLoginResult) => void;
  theme: AppTheme;
};

export const LoginScreen = ({ onSignedIn, theme }: LoginScreenProps) => {
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string>();
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not signed in");

  const oauthProviders = useMemo(() => ["google", "apple"] as const, []);

  const saveResult = (result: ProviderLoginResult) => {
    onSignedIn(result);
    setStatus(`Signed in via ${result.user.identities.map((identity) => identity.provider).join(", ")}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Sign in</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Phone + social first. Email/password is fallback.</Text>

      <TextInput placeholder="Phone number" placeholderTextColor={theme.colors.textSecondary} value={phone} onChangeText={setPhone} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const challenge = await authService.startPhoneLogin(phone);
          setChallengeId(challenge.challengeId);
          setDevCode(challenge.deliveryCodeForDevOnly);
        }}
      >
        <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Send SMS code</Text>
      </Pressable>

      {challengeId ? (
        <>
          <TextInput placeholder="One-time code" placeholderTextColor={theme.colors.textSecondary} value={code} onChangeText={setCode} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={async () => {
              const result = await authService.verifyPhoneCode(challengeId, code);
              saveResult(result);
            }}
          >
            <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Verify code</Text>
          </Pressable>
          <Text style={[styles.devCode, { color: theme.colors.accent }]}>Dev code: {devCode}</Text>
        </>
      ) : null}

      {oauthProviders.map((provider) => (
        <Pressable
          key={provider}
          style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
          onPress={async () => {
            const result = await authService.loginWithOAuth(provider, `${provider}-mobile-user`, "reader@example.com");
            saveResult(result);
          }}
        >
          <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Continue with {provider === "google" ? "Google" : "Apple"}</Text>
        </Pressable>
      ))}

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
            const result = await authService.loginWithEmailPassword(email, password);
            saveResult(result);
          }}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.textPrimary }]}>Sign in with email</Text>
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
  status: { marginTop: 4 },
  devCode: { fontSize: 12 }
});
