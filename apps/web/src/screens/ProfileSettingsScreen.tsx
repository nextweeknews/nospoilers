import { useState, type CSSProperties } from "react";
import type { AuthUser } from "@nospoilers/auth";
import { authService } from "../services/authClient";

type ProfileSettingsScreenProps = {
  userId?: string;
  onProfileUpdated: (user: AuthUser) => void;
};

export const ProfileSettingsScreen = ({ userId, onProfileUpdated }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("avatar.png");
  const [status, setStatus] = useState("Sign in to manage your profile.");

  if (!userId) {
    return <section style={cardStyle}>Sign in first, then open Account to edit your profile.</section>;
  }

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: 0 }}>Account settings</h2>

      <div style={rowStyle}>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" style={inputStyle} />
        <button
          style={buttonStyle}
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
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" style={inputStyle} />
        <button
          style={buttonStyle}
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

      <div style={rowStyle}>
        <input value={avatarFileName} onChange={(event) => setAvatarFileName(event.target.value)} placeholder="avatar.png" style={inputStyle} />
        <button
          style={buttonStyle}
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

      <small>{status}</small>
    </section>
  );
};

const cardStyle: CSSProperties = {
  background: "#111827",
  borderRadius: 16,
  padding: 20,
  color: "#f8fafc",
  display: "grid",
  gap: 12
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8
};

const inputStyle: CSSProperties = {
  background: "#1f2937",
  color: "#f8fafc",
  borderRadius: 8,
  border: "1px solid #334155",
  padding: "10px 12px"
};

const buttonStyle: CSSProperties = {
  background: "#2563eb",
  color: "#eff6ff",
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: 600
};
