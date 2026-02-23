import { useState, type CSSProperties } from "react";
import type { AuthUser } from "@nospoilers/auth";
import { radiusTokens, spacingTokens, type AppTheme, type ThemePreference } from "@nospoilers/ui";
import { authService } from "../services/authClient";

type ProfileSettingsScreenProps = {
  userId?: string;
  onProfileUpdated: (user: AuthUser) => void;
  themePreference: ThemePreference;
  onThemePreferenceChanged: (next: ThemePreference) => void;
  theme: AppTheme;
};

export const ProfileSettingsScreen = ({ userId, onProfileUpdated, themePreference, onThemePreferenceChanged, theme }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("avatar.png");
  const [status, setStatus] = useState("Sign in to manage your profile.");

  if (!userId) {
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
            const user = await authService.updateProfile(userId, { displayName });
            setStatus(`Display name saved: ${user.displayName ?? "(none)"}`);
            onProfileUpdated(user);
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
            await authService.reserveUsername(username, userId);
            const user = await authService.updateProfile(userId, { username });
            setStatus(`Username set to @${user.username}`);
            onProfileUpdated(user);
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
            const user = await authService.updateProfile(userId, { themePreference: next });
            onProfileUpdated(user);
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
            const upload = await authService.createAvatarUploadPlan(userId, {
              fileName: avatarFileName,
              contentType: "image/png",
              bytes: 220_000,
              width: 512,
              height: 512
            });
            const user = await authService.finalizeAvatarUpload(userId, upload.uploadId, {
              contentType: "image/png",
              bytes: 220_000,
              width: 512,
              height: 512
            });
            setStatus(`Avatar updated via signed URL pipeline: ${upload.uploadUrl}`);
            onProfileUpdated(user);
          }}
        >
          Update avatar
        </button>
      </div>

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
