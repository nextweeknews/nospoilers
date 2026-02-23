import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ProviderLoginResult } from "@nospoilers/auth";
import { authService } from "../services/authClient";

type LoginScreenProps = {
  onSignedIn: (result: ProviderLoginResult) => void;
};

export const LoginScreen = ({ onSignedIn }: LoginScreenProps) => {
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
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Phone + social first. Email/password is fallback.</Text>

      <TextInput placeholder="Phone number" placeholderTextColor="#64748b" value={phone} onChangeText={setPhone} style={styles.input} />
      <Pressable
        style={styles.primaryButton}
        onPress={async () => {
          const challenge = await authService.startPhoneLogin(phone);
          setChallengeId(challenge.challengeId);
          setDevCode(challenge.deliveryCodeForDevOnly);
        }}
      >
        <Text style={styles.primaryText}>Send SMS code</Text>
      </Pressable>

      {challengeId ? (
        <>
          <TextInput placeholder="One-time code" placeholderTextColor="#64748b" value={code} onChangeText={setCode} style={styles.input} />
          <Pressable
            style={styles.primaryButton}
            onPress={async () => {
              const result = await authService.verifyPhoneCode(challengeId, code);
              saveResult(result);
            }}
          >
            <Text style={styles.primaryText}>Verify code</Text>
          </Pressable>
          <Text style={styles.devCode}>Dev code: {devCode}</Text>
        </>
      ) : null}

      {oauthProviders.map((provider) => (
        <Pressable
          key={provider}
          style={styles.primaryButton}
          onPress={async () => {
            const result = await authService.loginWithOAuth(provider, `${provider}-mobile-user`, "reader@example.com");
            saveResult(result);
          }}
        >
          <Text style={styles.primaryText}>Continue with {provider === "google" ? "Google" : "Apple"}</Text>
        </Pressable>
      ))}

      <View style={styles.fallbackSection}>
        <Text style={styles.fallbackLabel}>Fallback: email/password</Text>
        <TextInput placeholder="Email" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={async () => {
            const result = await authService.loginWithEmailPassword(email, password);
            saveResult(result);
          }}
        >
          <Text style={styles.secondaryText}>Sign in with email</Text>
        </Pressable>
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: "#0f172a", borderRadius: 12, padding: 16, gap: 10 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "600" },
  subtitle: { color: "#94a3b8" },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#1e293b"
  },
  primaryButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  primaryText: { color: "#eff6ff", fontWeight: "600" },
  fallbackSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#334155", paddingTop: 10, opacity: 0.7, gap: 8 },
  fallbackLabel: { color: "#94a3b8", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.8 },
  secondaryButton: { backgroundColor: "#1e293b", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  secondaryText: { color: "#cbd5e1", fontWeight: "600" },
  status: { color: "#a7f3d0", marginTop: 4 },
  devCode: { color: "#93c5fd", fontSize: 12 }
});
