import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";
import { supabaseClient } from "../services/supabaseClient";
import { checkUsernameAvailability } from "../services/username";
import { isUsernameFormatValid, normalizeUsername } from "../services/usernameValidation";

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
  if (!value) {
    return { tone: "neutral", message: "" };
  }

  if (!isUsernameFormatValid(value)) {
    return { tone: "error", message: "Use 3-16 chars: letters, numbers, underscore." };
  }

  return { tone: "neutral", message: "" };
};

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted, onChooseDifferentLoginMethod }: OnboardingProfileScreenProps) => {
  const defaultStatus = "Finish your profile to continue.";
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState((user.username ?? "").toLowerCase());
  const [avatarFileName, setAvatarFileName] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(defaultStatus);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; general?: string }>({});
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({ tone: "neutral", message: "" });

  useEffect(() => {
    let active = true;
    const normalized = normalizeUsername(username);
    const localValidation = validateUsername(normalized);

    if (!normalized) {
      setCheckingUsername(false);
      setUsernameFeedback({ tone: "neutral", message: "" });
      return;
    }

    if (localValidation.tone === "error") {
      setCheckingUsername(false);
      setUsernameFeedback(localValidation);
      return;
    }

    setCheckingUsername(false);
    const timeout = window.setTimeout(() => {
      setCheckingUsername(true);
      void (async () => {
        const availability = await checkUsernameAvailability(normalized);

        if (!active) {
          return;
        }

        setCheckingUsername(false);
        const unavailable = !availability.available && normalized !== user.usernameNormalized;

        if (availability.error) {
          setUsernameFeedback({ tone: "error", message: "Could not check username right now." });
          return;
        }

        if (unavailable) {
          setUsernameFeedback({ tone: "error", message: "This username is not available." });
          return;
        }

        setUsernameFeedback({ tone: "success", message: "This username is available." });
      })();
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [username, user.usernameNormalized]);

  const submitProfile = async (skipOptional: boolean) => {
    const nextDisplayName = displayName.trim();
    const nextUsername = normalizeUsername(username);

    if (!nextUsername) {
      setFieldErrors((prev) => ({ ...prev, username: "Username is required." }));
      return;
    }

    const usernameValidation = validateUsername(nextUsername);
    if (usernameValidation.tone === "error") {
      setFieldErrors((prev) => ({ ...prev, username: usernameValidation.message }));
      return;
    }

    setSaving(true);
    setFieldErrors((prev) => ({ ...prev, general: undefined }));

    try {
      const availability = await checkUsernameAvailability(nextUsername);
      if (availability.error) {
        setFieldErrors((prev) => ({ ...prev, general: "Could not check username right now." }));
        return;
      }

      if (!availability.available && nextUsername !== user.usernameNormalized) {
        setFieldErrors((prev) => ({ ...prev, username: "This username is not available." }));
        return;
      }

      if (availability.available) {
        await authService.reserveUsername(nextUsername, user.id);
      }

      let updatedUser = await authService.updateProfile(user.id, {
        displayName: skipOptional ? nextUsername : nextDisplayName || nextUsername,
        username: nextUsername
      });

      const profilePayload = {
        id: user.id,
        username: nextUsername,
        display_name: skipOptional ? nextUsername : nextDisplayName || nextUsername,
        email: user.email ?? null,
        avatar_url: updatedUser.avatarUrl ?? null,
        updated_at: new Date().toISOString()
      };

      const { error: userInsertError } = await supabaseClient.from("users").insert(profilePayload);

      if (userInsertError && userInsertError.code !== "23505") {
        setFieldErrors((prev) => ({ ...prev, general: userInsertError.message }));
        return;
      }

      if (!skipOptional && avatarFileName && isBlank(updatedUser.avatarUrl)) {
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

      const completedUser: AuthUser = updatedUser.username
        ? updatedUser
        : {
            ...updatedUser,
            username: nextUsername,
            usernameNormalized: nextUsername
          };

      setStatus("Profile complete. Redirecting to the app…");
      onProfileCompleted(completedUser);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle(theme)}>
      <h2 style={{ margin: 0, color: theme.colors.textPrimary }}>Complete your profile</h2>
      <small style={{ color: theme.colors.textSecondary, fontWeight: 600 }}>Step {step} of 2</small>
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>
        {step === 1
          ? "Pick a unique username so friends can find you and mentions stay unambiguous."
          : "Add optional profile details now, or skip and personalize later."}
      </p>

      {step === 1 ? (
        <>
          <label style={labelStyle(theme)}>
            Username
            <input
              value={username}
              onChange={(event) => {
                const nextUsername = event.target.value.toLowerCase();
                setUsername(nextUsername);
                setFieldErrors((prev) => ({ ...prev, username: undefined }));

                if (validateUsername(nextUsername.trim()).tone !== "error") {
                  setStatus(defaultStatus);
                }
              }}
              placeholder="Username"
              maxLength={16}
              style={inputStyle(theme)}
            />
            {fieldErrors.username ? <small style={{ color: "#d14343" }}>{fieldErrors.username}</small> : null}
            <small style={{ color: usernameFeedback.tone === "error" ? "#d14343" : usernameFeedback.tone === "success" ? theme.colors.success : theme.colors.textSecondary }}>
              {checkingUsername ? "Checking availability…" : usernameFeedback.message}
            </small>
          </label>

          <button
            type="button"
            style={buttonStyle(theme)}
            disabled={saving || checkingUsername || usernameFeedback.tone === "error" || !username.trim()}
            onClick={() => {
              const nextUsername = normalizeUsername(username);
              const usernameValidation = validateUsername(nextUsername);

              if (!nextUsername) {
                setFieldErrors((prev) => ({ ...prev, username: "Username is required." }));
                return;
              }

              if (usernameValidation.tone === "error") {
                setFieldErrors((prev) => ({ ...prev, username: usernameValidation.message }));
                return;
              }

              if (usernameFeedback.tone === "error") {
                setFieldErrors((prev) => ({ ...prev, username: usernameFeedback.message }));
                return;
              }

              setStep(2);
            }}
          >
            Continue
          </button>
        </>
      ) : (
        <>
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

          <button type="button" style={buttonStyle(theme)} disabled={saving} onClick={() => void submitProfile(false)}>
            {saving ? "Saving…" : "Save and continue"}
          </button>
          <button type="button" style={secondaryButtonStyle(theme)} disabled={saving} onClick={() => void submitProfile(true)}>
            Skip for now
          </button>
        </>
      )}

      <button
        type="button"
        style={escapeButtonStyle(theme)}
        onClick={() => {
          void onChooseDifferentLoginMethod();
        }}
      >
        Choose a different login method
      </button>

      {fieldErrors.general ? <small style={{ color: "#d14343" }}>{fieldErrors.general}</small> : null}
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

const escapeButtonStyle = (theme: AppTheme): CSSProperties => ({
  background: "transparent",
  color: theme.colors.textSecondary,
  border: "none",
  textAlign: "left",
  padding: "4px 0",
  fontWeight: 500,
  textDecoration: "underline",
  cursor: "pointer"
});
