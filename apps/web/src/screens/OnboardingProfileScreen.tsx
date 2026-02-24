import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";
import { supabaseClient } from "../services/supabaseClient";

type OnboardingProfileScreenProps = {
  user: AuthUser;
  theme: AppTheme;
  onProfileCompleted: (user: AuthUser) => void;
  onChooseDifferentLoginMethod: () => Promise<void>;
};

type UsernameFeedback = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const isBlank = (value?: string): boolean => !value || value.trim().length === 0;

const validateUsername = (value: string): UsernameFeedback => {
  if (value.length < 3 || value.length > 16) {
    return { tone: "error", message: "Usernames must be 3-16 characters." };
  }

  return { tone: "neutral", message: "" };
};

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted, onChooseDifferentLoginMethod }: OnboardingProfileScreenProps) => {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState((user.username ?? "").toLowerCase());
  const [avatarFileName, setAvatarFileName] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("Finish your profile to continue.");
  const [saving, setSaving] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({ tone: "neutral", message: "" });

  useEffect(() => {
    let active = true;
    const normalized = username.trim().toLowerCase();
    const localValidation = validateUsername(normalized);
    if (!normalized || localValidation.tone === "error") {
      setUsernameFeedback(localValidation);
      return;
    }


    const runCheck = async () => {
      const [availability, dbResult] = await Promise.all([
        authService.checkUsernameAvailability(normalized),
        supabaseClient.from("profiles").select("id", { count: "exact", head: true }).eq("username", normalized).neq("id", user.id)
      ]);

      if (!active) {
        return;
      }

      const takenInDb = !dbResult.error && (dbResult.count ?? 0) > 0;
      const unavailableInAuth = !availability.available && availability.normalized !== user.usernameNormalized;

      if (unavailableInAuth || takenInDb) {
        setUsernameFeedback({ tone: "error", message: "This username is not available." });
        return;
      }

      setUsernameFeedback({ tone: "success", message: "This username is available." });
    };

    const timeout = window.setTimeout(() => {
      void runCheck();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [username, user.id, user.usernameNormalized]);

  return (
    <section style={cardStyle(theme)}>
      <h2 style={{ margin: 0, color: theme.colors.textPrimary }}>Complete your profile</h2>
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>
        Add a username to continue. Display name is optional and defaults to your username.
      </p>

      <label style={labelStyle(theme)}>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="Username" maxLength={16} style={inputStyle(theme)} />
        <small style={{ color: usernameFeedback.tone === "error" ? "#d14343" : usernameFeedback.tone === "success" ? theme.colors.success : theme.colors.textSecondary }}>
          {usernameFeedback.message}
        </small>
      </label>

      <label style={labelStyle(theme)}>
        Display name (optional)
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" style={inputStyle(theme)} />
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          setAvatarFileName(selected?.name);
        }}
      />

      <div
        style={uploadBoxStyle(theme)}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const selected = event.dataTransfer.files?.[0];
          setAvatarFileName(selected?.name);
        }}
      >
        <strong style={{ color: theme.colors.textPrimary }}>Upload avatar (optional)</strong>
        <span style={{ color: theme.colors.textSecondary }}>Drag and drop an image here, or click to upload from your computer.</span>
        <small style={{ color: theme.colors.textSecondary }}>Selected: {avatarFileName ?? "No file selected. Using placeholder avatar."}</small>
      </div>

      <button
        type="button"
        style={buttonStyle(theme)}
        disabled={saving}
        onClick={async () => {
          const nextDisplayName = displayName.trim();
          const nextUsername = username.trim().toLowerCase();

          if (!nextUsername) {
            setStatus("Username is required.");
            return;
          }

          if (validateUsername(nextUsername).tone === "error") {
            setStatus(validateUsername(nextUsername).message);
            return;
          }

          setSaving(true);
          try {
            const availability = await authService.checkUsernameAvailability(nextUsername);
            if (!availability.available && availability.normalized !== user.usernameNormalized) {
              setStatus("This username is not available.");
              return;
            }

            if (availability.available) {
              await authService.reserveUsername(nextUsername, user.id);
            }

            let updatedUser = await authService.updateProfile(user.id, {
              displayName: nextDisplayName || nextUsername,
              username: nextUsername
            });

            if (avatarFileName && isBlank(updatedUser.avatarUrl)) {
              const upload = await authService.createAvatarUploadPlan(user.id, {
                fileName: avatarFileName,
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

      <button
        type="button"
        style={secondaryButtonStyle(theme)}
        onClick={() => {
          void onChooseDifferentLoginMethod();
        }}
      >
        Choose a different login method
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

const uploadBoxStyle = (theme: AppTheme): CSSProperties => ({
  border: `1px dashed ${theme.colors.border}`,
  borderRadius: radiusTokens.sm,
  background: theme.colors.surfaceMuted,
  padding: spacingTokens.md,
  display: "grid",
  gap: 6,
  cursor: "pointer"
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

const secondaryButtonStyle = (theme: AppTheme): CSSProperties => ({
  background: "transparent",
  color: theme.colors.textPrimary,
  borderRadius: radiusTokens.sm,
  border: `1px solid ${theme.colors.border}`,
  padding: "10px 12px",
  fontWeight: 600,
  cursor: "pointer"
});
