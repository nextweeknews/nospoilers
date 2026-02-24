import { useMemo, useState, type CSSProperties } from "react";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme, type ThemePreference } from "@nospoilers/ui";
import { authService, deleteAccount, getAuthUser, linkEmailPasswordIdentity, linkGoogleIdentity, linkPhoneIdentity, reauthenticateForIdentityLink } from "../services/authClient";

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

  const refreshIdentityState = async () => {
    if (!user) {
      return;
    }

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

    onProfileUpdated({
      ...user,
      email: data.user.email,
      primaryPhone: data.user.phone,
      identities
    });
  };

  if (!user) {
    return <section style={cardStyle(theme)}>Sign in first, then open Account to edit your profile.</section>;
  }

  return (
    <section style={cardStyle(theme)}>
      <h2 style={{ margin: 0 }}>Account settings</h2>

      <div style={rowStyle}>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" style={inputStyle(theme)} />
        <button
          style={buttonStyle(theme)}
          onClick={async () => {
            const updatedUser = await authService.updateProfile(user.id, { displayName });
            setStatus(`Display name saved: ${updatedUser.displayName ?? "(none)"}`);
            onProfileUpdated(updatedUser);
          }}
        >
          Save display name
        </button>
      </div>

      <div style={rowStyle}>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" style={inputStyle(theme)} />
        <button
          style={buttonStyle(theme)}
          onClick={async () => {
            const availability = await authService.checkUsernameAvailability(username);
            if (!availability.available) {
              setStatus(`Username unavailable (${availability.reason ?? "unknown"}).`);
              return;
            }
            await authService.reserveUsername(username, user.id);
            const updatedUser = await authService.updateProfile(user.id, { username });
            setStatus(`Username set to @${updatedUser.username}`);
            onProfileUpdated(updatedUser);
          }}
        >
          Reserve + save username
        </button>
      </div>

      <label style={{ color: theme.colors.textSecondary }}>
        Theme preference
        <select
          style={{ ...inputStyle(theme), marginTop: 8 }}
          value={themePreference}
          onChange={async (event) => {
            const next = event.target.value as ThemePreference;
            const updatedUser = await authService.updateProfile(user.id, { themePreference: next });
            onProfileUpdated(updatedUser);
            onThemePreferenceChanged(next);
            setStatus(`Theme preference saved as ${next}.`);
          }}
        >
          <option value="system">Use system setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <div style={rowStyle}>
        <input value={avatarFileName} onChange={(event) => setAvatarFileName(event.target.value)} placeholder="avatar.png" style={inputStyle(theme)} />
        <button
          style={buttonStyle(theme)}
          onClick={async () => {
            const upload = await authService.createAvatarUploadPlan(user.id, {
              fileName: avatarFileName,
              contentType: "image/png",
              bytes: 220_000,
              width: 512,
              height: 512
            });
            const updatedUser = await authService.finalizeAvatarUpload(user.id, upload.uploadId, {
              contentType: "image/png",
              bytes: 220_000,
              width: 512,
              height: 512
            });
            setStatus(`Avatar updated via signed URL pipeline: ${upload.uploadUrl}`);
            onProfileUpdated(updatedUser);
          }}
        >
          Update avatar
        </button>
      </div>

      <section style={{ display: "grid", gap: spacingTokens.sm, borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm }}>
        <h3 style={{ margin: 0 }}>Connected sign-in methods</h3>
        <small style={{ color: theme.colors.textSecondary }}>Phone: {identityStatus.phone ? "Connected" : "Not connected"} · Google: {identityStatus.google ? "Connected" : "Not connected"} · Email/password: {identityStatus.email ? "Connected" : "Not connected"}</small>

        <div style={rowStyle}>
          <input value={linkPhone} onChange={(event) => setLinkPhone(event.target.value)} placeholder="+1 555 123 9876" style={inputStyle(theme)} />
          <button
            style={buttonStyle(theme)}
            onClick={async () => {
              await reauthenticateForIdentityLink();
              const { error } = await linkPhoneIdentity(linkPhone);
              if (error) {
                setStatus(error.message);
                return;
              }
              await refreshIdentityState();
              setStatus("Phone link started. Verify OTP sent to complete linking.");
            }}
          >
            Link phone
          </button>
        </div>

        <button
          style={buttonStyle(theme)}
          onClick={async () => {
            await reauthenticateForIdentityLink();
            const { error } = await linkGoogleIdentity();
            if (error) {
              setStatus(error.message);
              return;
            }
            setStatus("Redirecting to Google to link identity...");
          }}
        >
          Link Google
        </button>

        <div style={rowStyle}>
          <input value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} placeholder="Email" style={inputStyle(theme)} />
          <input value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} type="password" placeholder="Password" style={inputStyle(theme)} />
          <button
            style={buttonStyle(theme)}
            onClick={async () => {
              await reauthenticateForIdentityLink();
              const { error } = await linkEmailPasswordIdentity(linkEmail, linkPassword);
              if (error) {
                setStatus(error.message);
                return;
              }
              await refreshIdentityState();
              setStatus("Email/password linked. Check your inbox if verification is required.");
            }}
          >
            Link email/password
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: spacingTokens.xs, borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm }}>
        <h3 style={{ margin: 0, color: "#b42318" }}>Delete account</h3>
        <small style={{ color: theme.colors.textSecondary }}>
          This action permanently deletes your profile and linked identities, revokes active sessions, and cannot be undone.
        </small>
        <input
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
          placeholder='Type "DELETE" to enable'
          style={inputStyle(theme)}
        />
        <button
          type="button"
          style={dangerButtonStyle(theme)}
          disabled={deleteConfirmation !== "DELETE"}
          onClick={() => {
            setDeleteError(undefined);
            setDeleteConfirmOpen(true);
          }}
        >
          Delete account permanently
        </button>
        {deleteError ? <small style={{ color: "#b42318" }}>{deleteError}</small> : null}
      </section>

      {deleteConfirmOpen ? (
        <div style={{ border: `1px solid ${"#b42318"}`, borderRadius: radiusTokens.md, padding: spacingTokens.sm, display: "grid", gap: spacingTokens.sm }}>
          <strong>Final confirmation</strong>
          <small style={{ color: theme.colors.textSecondary }}>Are you sure? This permanently removes your account data and signs you out of all devices.</small>
          <div style={{ display: "flex", gap: spacingTokens.sm }}>
            <button type="button" style={dangerButtonStyle(theme)} onClick={async () => {
              const { error } = await deleteAccount();
              if (error) {
                setDeleteError(error.message);
                setDeleteConfirmOpen(false);
                return;
              }
              onAccountDeleted();
            }}>Yes, delete my account</button>
            <button type="button" style={buttonStyle(theme)} onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      <small style={{ color: theme.colors.success }}>{status}</small>
    </section>
  );
};

const cardStyle = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.lg,
  padding: 20,
  color: theme.colors.textPrimary,
  display: "grid",
  gap: spacingTokens.sm
});

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: spacingTokens.sm
};

const inputStyle = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.surfaceMuted,
  color: theme.colors.textPrimary,
  borderRadius: radiusTokens.sm,
  border: `1px solid ${theme.colors.border}`,
  padding: "10px 12px"
});

const buttonStyle = (theme: AppTheme): CSSProperties => ({
  background: theme.colors.accent,
  color: theme.colors.accentText,
  border: "none",
  borderRadius: radiusTokens.sm,
  padding: "10px 12px",
  fontWeight: 600
});

const dangerButtonStyle = (theme: AppTheme): CSSProperties => ({
  background: "#b42318",
  color: "#fff",
  border: "none",
  borderRadius: radiusTokens.sm,
  padding: "10px 12px",
  fontWeight: 700,
  opacity: 1
});
