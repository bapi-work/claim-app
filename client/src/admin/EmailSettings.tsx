import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface EmailSettingsData {
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  hasPassword: boolean;
  fromName: string;
  fromAddress: string | null;
}

export function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsData | null>(null);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    const data = await api.get<EmailSettingsData>("/settings/email");
    setSettings(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await api.put<EmailSettingsData>("/settings/email", {
        enabled: settings.enabled,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpPassword: smtpPassword || undefined,
        fromName: settings.fromName,
        fromAddress: settings.fromAddress,
      });
      setSettings(updated);
      setSmtpPassword("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save email settings");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestStatus(null);
    try {
      await api.post("/settings/email/test", {});
      setTestStatus("Test email sent — check your inbox.");
    } catch (err) {
      setTestStatus(err instanceof ApiError ? `Failed: ${err.message}` : "Failed to send test email");
    } finally {
      setTesting(false);
    }
  }

  if (!settings) return <p className="page-subtitle">Loading...</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="page-header">
        <div>
          <h2>Email Settings</h2>
          <p className="page-subtitle">Configure the SMTP server used for claim notification emails (Admin only).</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Enable email alerts
            </label>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">SMTP host</label>
              <input
                className="input"
                value={settings.smtpHost ?? ""}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="field">
              <label className="label">SMTP port</label>
              <input
                type="number"
                className="input"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="field">
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.smtpSecure}
                onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
              />
              Use TLS/SSL (secure connection)
            </label>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">SMTP username</label>
              <input
                className="input"
                value={settings.smtpUser ?? ""}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label">
                SMTP password {settings.hasPassword && <span className="page-subtitle">(saved — leave blank to keep)</span>}
              </label>
              <input
                type="password"
                className="input"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={settings.hasPassword ? "••••••••" : ""}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">From name</label>
              <input
                className="input"
                value={settings.fromName}
                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label">From address</label>
              <input
                type="email"
                className="input"
                value={settings.fromAddress ?? ""}
                onChange={(e) => setSettings({ ...settings, fromAddress: e.target.value })}
                placeholder="claims@example.com"
              />
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {saved && (
            <div className="alert" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
              Email settings saved.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              Save settings
            </button>
            <button type="button" className="btn" onClick={handleTest} disabled={testing}>
              {testing ? "Sending..." : "Send test email"}
            </button>
          </div>
          {testStatus && <p className="page-subtitle" style={{ marginTop: 8 }}>{testStatus}</p>}
        </form>
      </div>
    </div>
  );
}
