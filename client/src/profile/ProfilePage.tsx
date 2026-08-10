import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  homeCurrency: string;
  twoFactorEnabled: boolean;
}

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [busy2fa, setBusy2fa] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function load() {
    const data = await api.get<ProfileData>("/profile");
    setProfile(data);
    setName(data.name);
    setHomeCurrency(data.homeCurrency);
  }

  useEffect(() => {
    load();
    api.get<{ currencies: string[] }>("/currency").then((res) => setCurrencies(res.currencies));
  }, []);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      await api.patch("/profile", { name, homeCurrency });
      await load();
      await refreshUser();
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setSavingPassword(true);
    try {
      await api.post("/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function startTwoFactorSetup() {
    setTwoFactorError(null);
    setBusy2fa(true);
    try {
      const res = await api.post<{ secret: string; qrDataUrl: string }>("/profile/2fa/setup", {});
      setSetupData(res);
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Failed to start 2FA setup");
    } finally {
      setBusy2fa(false);
    }
  }

  async function confirmTwoFactor(e: FormEvent) {
    e.preventDefault();
    setTwoFactorError(null);
    setBusy2fa(true);
    try {
      await api.post("/profile/2fa/verify", { token: verifyCode });
      setSetupData(null);
      setVerifyCode("");
      await load();
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setBusy2fa(false);
    }
  }

  async function disableTwoFactor(e: FormEvent) {
    e.preventDefault();
    setTwoFactorError(null);
    setBusy2fa(true);
    try {
      await api.post("/profile/2fa/disable", { password: disablePassword });
      setDisablePassword("");
      setShowDisableForm(false);
      await load();
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Failed to disable 2FA");
    } finally {
      setBusy2fa(false);
    }
  }

  if (!profile) return <p className="page-subtitle">Loading...</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="page-header">
        <div>
          <h2>My Profile</h2>
          <p className="page-subtitle">Manage your account details, password, and two-factor authentication.</p>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Account</p>
        <form onSubmit={handleProfileSubmit}>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" value={profile.email} disabled />
          </div>
          <div className="form-row">
            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Home currency</label>
              <select className="select" value={homeCurrency} onChange={(e) => setHomeCurrency(e.target.value)}>
                {(currencies.length > 0 ? currencies : [homeCurrency]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {profileError && <div className="alert alert-danger">{profileError}</div>}
          {profileSaved && (
            <div className="alert" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
              Profile updated.
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={savingProfile}>
            Save changes
          </button>
        </form>
      </div>

      <div className="card">
        <p className="section-title">Change password</p>
        <form onSubmit={handlePasswordSubmit}>
          <div className="field">
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {passwordError && <div className="alert alert-danger">{passwordError}</div>}
          {passwordSaved && (
            <div className="alert" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
              Password changed.
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={savingPassword}>
            Update password
          </button>
        </form>
      </div>

      <div className="card">
        <p className="section-title">Two-factor authentication</p>
        {twoFactorError && <div className="alert alert-danger">{twoFactorError}</div>}

        {profile.twoFactorEnabled ? (
          <>
            <p>
              <span className="badge badge-success">Enabled</span> Your account is protected with an authenticator
              app.
            </p>
            {!showDisableForm ? (
              <button className="btn btn-danger btn-sm" onClick={() => setShowDisableForm(true)}>
                Disable 2FA
              </button>
            ) : (
              <form onSubmit={disableTwoFactor} style={{ marginTop: 12 }}>
                <div className="field">
                  <label className="label">Confirm your password to disable 2FA</label>
                  <input
                    type="password"
                    className="input"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-danger btn-sm" disabled={busy2fa}>
                  Confirm disable
                </button>
                <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowDisableForm(false)}>
                  Cancel
                </button>
              </form>
            )}
          </>
        ) : setupData ? (
          <form onSubmit={confirmTwoFactor}>
            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
            <img src={setupData.qrDataUrl} alt="2FA QR code" style={{ width: 180, height: 180, marginBottom: 8 }} />
            <p className="page-subtitle">
              Or enter this secret manually: <code>{setupData.secret}</code>
            </p>
            <div className="field">
              <label className="label">Enter the 6-digit code to confirm</label>
              <input
                className="input"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy2fa || verifyCode.length !== 6}>
              Confirm &amp; enable
            </button>
            <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setSetupData(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <p>
              <span className="badge badge-neutral">Disabled</span> Add an extra layer of security to your account.
            </p>
            <button className="btn btn-primary btn-sm" onClick={startTwoFactorSetup} disabled={busy2fa}>
              Enable 2FA
            </button>
          </>
        )}
      </div>
    </div>
  );
}
