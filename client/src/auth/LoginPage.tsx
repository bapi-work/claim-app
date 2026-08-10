import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { api, ApiError } from "../api/client";

interface PublicBranding {
  appName: string;
  logoText: string;
  primaryColor: string;
}

export function LoginPage() {
  const { login, verifyTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("employee@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    api.get<PublicBranding>("/settings/branding/public").then(setBranding).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setChallengeToken(result.challengeToken);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyTwoFactorLogin(challengeToken, otp);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  const appName = branding?.appName ?? "Claim App";
  const logoText = branding?.logoText ?? "CA";

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="app-brand" style={{ marginBottom: 20 }}>
          <span className="app-brand-mark" style={branding ? { background: branding.primaryColor } : undefined}>
            {logoText}
          </span>
          {appName}
        </div>

        {!challengeToken ? (
          <>
            <h1 style={{ fontSize: 20 }}>Welcome back</h1>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              Sign in to submit or manage expense claims.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="auth-hint">
              Seeded logins: admin@example.com &middot; hr@example.com &middot; manager@example.com &middot;
              employee@example.com &middot; finance@example.com
              <br />
              Password: password123
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20 }}>Two-factor verification</h1>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <form onSubmit={handleVerify}>
              <div className="field">
                <label className="label">Verification code</label>
                <input
                  className="input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting || otp.length !== 6}>
                {submitting ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                className="btn btn-block"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setChallengeToken(null);
                  setOtp("");
                  setError(null);
                }}
              >
                Back to login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
