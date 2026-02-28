import { useMemo, useState } from "react";
import type { AuthUser } from "../../../../services/auth/src";
import { type AppTheme, type ThemePreference } from "@nospoilers/ui";
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  Select,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { authService, deleteAccount, getAuthUser, linkEmailPasswordIdentity, linkGoogleIdentity, linkPhoneIdentity, reauthenticateForIdentityLink, verifyPhoneChangeOtp } from "../services/authClient";

type ProfileSettingsScreenProps = {
  user?: AuthUser;
  onProfileUpdated: (user: AuthUser) => void;
  onAccountDeleted: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChanged: (next: ThemePreference) => void;
  theme: AppTheme;
};

export const ProfileSettingsScreen = ({ user, onProfileUpdated, onAccountDeleted, themePreference, onThemePreferenceChanged, theme }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("avatar.png");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkPhoneOtp, setLinkPhoneOtp] = useState("");
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [status, setStatus] = useState("Sign in to manage your profile.");

  const identityStatus = useMemo(() => {
    const providers = new Set((user?.identities ?? []).map((identity) => identity.provider));
    return {
      phone: providers.has("phone"),
      google: providers.has("google"),
      email: providers.has("email")
    };
  }, [user]);

  // Refreshing from Supabase Auth keeps the UI in sync with identities that can change outside this screen (for example after OAuth redirects).
  const refreshIdentityState = async () => {
    if (!user) return;
    const { data, error } = await getAuthUser();
    if (error || !data.user) {
      setStatus(error?.message ?? "Unable to refresh identity status.");
      return;
    }
    const identities = (data.user.identities ?? []).map((identity) => ({
      provider: identity.provider === "sms" ? "phone" : (identity.provider as "phone" | "google" | "email"),
      subject: identity.identity_id,
      verified: Boolean(identity.last_sign_in_at)
    }));
    onProfileUpdated({ ...user, email: data.user.email, primaryPhone: data.user.phone, identities });
  };

  if (!user) {
    return (
      <Card>
        <Text>Sign in first, then open Account to edit your profile.</Text>
      </Card>
    );
  }

  return (
    <Card style={{ border: `1px solid ${theme.colors.border}` }}>
      <Flex direction="column" gap="3">
        <Heading as="h2" size="4">Account settings</Heading>

        {/* Keep each action in the same two-column Radix layout so button behavior stays unchanged while visuals are standardized. */}
        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" /></Box>
          <Button onClick={async () => { const updatedUser = await authService.updateProfile(user.id, { displayName }); setStatus(`Display name saved: ${updatedUser.displayName ?? "(none)"}`); onProfileUpdated(updatedUser); }}>Save display name</Button>
        </Flex>

        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" /></Box>
          <Button onClick={async () => {
            const availability = await authService.checkUsernameAvailability(username);
            if (!availability.available) { setStatus(`Username unavailable (${availability.reason ?? "unknown"}).`); return; }
            await authService.reserveUsername(username, user.id);
            const updatedUser = await authService.updateProfile(user.id, { username });
            setStatus(`Username set to @${updatedUser.username}`);
            onProfileUpdated(updatedUser);
          }}>Reserve + save username</Button>
        </Flex>

        <Flex direction="column" gap="1">
          <Text size="2" style={{ color: theme.colors.textSecondary }}>Theme preference</Text>
          <Select.Root
            value={themePreference}
            onValueChange={async (next) => {
              const value = next as ThemePreference;
              const updatedUser = await authService.updateProfile(user.id, { themePreference: value });
              onProfileUpdated(updatedUser);
              onThemePreferenceChanged(value);
              setStatus(`Theme preference saved as ${value}.`);
            }}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="system">Use system setting</Select.Item>
              <Select.Item value="light">Light</Select.Item>
              <Select.Item value="dark">Dark</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={avatarFileName} onChange={(event) => setAvatarFileName(event.target.value)} placeholder="avatar.png" /></Box>
          <Button onClick={async () => {
            const upload = await authService.createAvatarUploadPlan(user.id, { fileName: avatarFileName, contentType: "image/png", bytes: 220_000, width: 512, height: 512 });
            const updatedUser = await authService.finalizeAvatarUpload(user.id, upload.uploadId, { contentType: "image/png", bytes: 220_000, width: 512, height: 512 });
            setStatus(`Avatar updated via signed URL pipeline: ${upload.uploadUrl}`);
            onProfileUpdated(updatedUser);
          }}>Update avatar</Button>
        </Flex>

        <Separator size="4" />
        <Heading as="h3" size="3">Connected sign-in methods</Heading>
        <Text size="1" style={{ color: theme.colors.textSecondary }}>Phone: {identityStatus.phone ? "Connected" : "Not connected"} · Google: {identityStatus.google ? "Connected" : "Not connected"} · Email/password: {identityStatus.email ? "Connected" : "Not connected"}</Text>

        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={linkPhone} onChange={(event) => setLinkPhone(event.target.value)} placeholder="+1 555 123 9876" /></Box>
          <Button onClick={async () => {
            // Phone linking is intentionally a two-step flow: first request OTP for the number, then verify the OTP before we show it as connected.
            if (identityStatus.phone) {
              setStatus("Phone is already connected on this account.");
              return;
            }
            const trimmedPhone = linkPhone.trim();
            if (trimmedPhone.length < 7) {
              setStatus("Enter a valid phone number before requesting a code.");
              return;
            }
            await reauthenticateForIdentityLink();
            const { error } = await linkPhoneIdentity(trimmedPhone);
            if (error) {
              setStatus(error.message);
              return;
            }
            setPendingPhoneVerification(true);
            setStatus("Phone link started. Enter the verification code sent to this number.");
          }}>Send phone verification code</Button>
        </Flex>

        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={linkPhoneOtp} onChange={(event) => setLinkPhoneOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit SMS code" /></Box>
          <Button onClick={async () => {
            if (!pendingPhoneVerification) {
              setStatus("Request a phone verification code first.");
              return;
            }
            if (linkPhoneOtp.length !== 6) {
              setStatus("Enter the 6-digit code sent to your new phone number.");
              return;
            }
            const { error } = await verifyPhoneChangeOtp(linkPhone.trim(), linkPhoneOtp);
            if (error) {
              setStatus(error.message);
              return;
            }
            await refreshIdentityState();
            setPendingPhoneVerification(false);
            setStatus("Phone linked and verified.");
            setLinkPhoneOtp("");
          }}>Verify linked phone</Button>
        </Flex>

        <Button onClick={async () => {
          if (identityStatus.google) {
            setStatus("Google is already connected on this account.");
            return;
          }
          await reauthenticateForIdentityLink();
          const { error } = await linkGoogleIdentity();
          if (error) {
            setStatus(error.message);
            return;
          }
          setStatus("Redirecting to Google to link identity...");
        }}>Link Google</Button>

        <Flex gap="2" align="center">
          <Box style={{ flex: 1 }}><TextField.Root value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} placeholder="Email" /></Box>
          <Box style={{ flex: 1 }}><TextField.Root type="password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} placeholder="Password" /></Box>
          <Button onClick={async () => {
            if (identityStatus.email) {
              setStatus("Email/password is already connected on this account.");
              return;
            }
            const trimmedEmail = linkEmail.trim().toLowerCase();
            if (!trimmedEmail || !linkPassword.trim()) {
              setStatus("Enter both an email and a password to add email/password sign-in.");
              return;
            }
            await reauthenticateForIdentityLink();
            const { error } = await linkEmailPasswordIdentity(trimmedEmail, linkPassword);
            if (error) {
              setStatus(error.message);
              return;
            }
            await refreshIdentityState();
            setStatus("Email/password linked. Check your inbox if email verification is required.");
          }}>Link email/password</Button>
        </Flex>

        <Separator size="4" />
        <Heading as="h3" size="3" color="red">Delete account</Heading>
        <Text size="1" style={{ color: theme.colors.textSecondary }}>This action permanently deletes your profile and linked identities, revokes active sessions, and cannot be undone.</Text>
        <TextField.Root value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder='Type "DELETE" to enable' />
        <Button color="red" disabled={deleteConfirmation !== "DELETE"} onClick={() => { setDeleteError(undefined); setDeleteConfirmOpen(true); }}>Delete account permanently</Button>
        {deleteError ? <Text size="1" color="red">{deleteError}</Text> : null}

        <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <Dialog.Content>
            <Dialog.Title>Final confirmation</Dialog.Title>
            <Dialog.Description>Are you sure? This permanently removes your account data and signs you out of all devices.</Dialog.Description>
            <Flex gap="2" justify="end" mt="3">
              <Button color="red" onClick={async () => { const { error } = await deleteAccount(); if (error) { setDeleteError(error.message); setDeleteConfirmOpen(false); return; } onAccountDeleted(); }}>Yes, delete my account</Button>
              <Button variant="soft" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        <Text size="1" style={{ color: theme.colors.success }}>{status}</Text>
      </Flex>
    </Card>
  );
};
