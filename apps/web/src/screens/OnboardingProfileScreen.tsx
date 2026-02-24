import { useMemo, useState, type CSSProperties } from "react";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";

type OnboardingProfileScreenProps = {
  user: AuthUser;
  theme: AppTheme;
  onProfileCompleted: (user: AuthUser) => void;
};

const isBlank = (value?: string): boolean => !value || value.trim().length === 0;

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted }: OnboardingProfileScreenProps) => {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [avatarFileName, setAvatarFileName] = useState("avatar.png");
  const [status, setStatus] = useState("Finish your profile to continue.");
  const [saving, setSaving] = useState(false);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (isBlank(displayName)) {
      missing.push("display name");
    }
    if (isBlank(username)) {
      missing.push("username");
    }
    if (isBlank(user.avatarUrl)) {
      missing.push("avatar");
    }
    return missing;
  }, [displayName, username, user.avatarUrl]);

  return (
    <section style={cardStyle(theme)}>
      <h2 style={{ margin: 0, color: theme.colors.textPrimary }}>Complete your profile</h2>
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>
        Add all required fields before entering NoSpoilers.
      </p>
      <small style={{ color: theme.colors.textSecondary }}>Missing: {missingFields.join(", ") || "none"}</small>

      <label style={labelStyle(theme)}>
        Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" style={inputStyle(theme)} />
      </label>

      <label style={labelStyle(theme)}>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" style={inputStyle(theme)} />
      </label>

      <label style={labelStyle(theme)}>
        Avatar file name
        <input value={avatarFileName} onChange={(event) => setAvatarFileName(event.target.value)} placeholder="avatar.png" style={inputStyle(theme)} />
      </label>

      <button
        type="button"
        style={buttonStyle(theme)}
        disabled={saving}
        onClick={async () => {
          const nextDisplayName = displayName.trim();
          const nextUsername = username.trim();

          if (!nextDisplayName || !nextUsername) {
            setStatus("Display name and username are required.");
            return;
          }

          setSaving(true);
          try {
            const availability = await authService.checkUsernameAvailability(nextUsername);
            if (!availability.available && availability.normalized !== user.usernameNormalized) {
              setStatus(`Username unavailable (${availability.reason ?? "unknown"}).`);
              return;
            }

            if (availability.available) {
              await authService.reserveUsername(nextUsername, user.id);
            }

            let updatedUser = await authService.updateProfile(user.id, {
              displayName: nextDisplayName,
              username: nextUsername
            });

            if (isBlank(updatedUser.avatarUrl)) {
              const upload = await authService.createAvatarUploadPlan(user.id, {
                fileName: avatarFileName || "avatar.png",
                contentType: "image/png",
                bytes: 220_000,
                width: 512,
                height: 512
              });

              updatedUser = await authService.finalizeAvatarUpload(user.id, upload.uploadId, {
                contentType: "image/png",
                bytes: 220_000,
                width: 512,
                height: 512
              });
            }

            setStatus("Profile complete. Redirecting to the app…");
            onProfileCompleted(updatedUser);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save and continue"}
      </button>

      <small style={{ color: theme.colors.success }}>{status}</small>
    </section>
  );
};

const cardStyle = (theme: AppTheme): CSSProperties => ({
  width: "min(520px, 100%)",
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.lg,
  padding: spacingTokens.lg,
  display: "grid",
  gap: spacingTokens.sm
});

const labelStyle = (theme: AppTheme): CSSProperties => ({
  color: theme.colors.textSecondary,
  display: "grid",
  gap: 8
});

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
  fontWeight: 600,
  cursor: "pointer"
});
