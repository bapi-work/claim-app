import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useBranding, BrandingLink } from "../branding/BrandingContext";

function LinkListEditor({
  title,
  hint,
  links,
  onChange,
}: {
  title: string;
  hint: string;
  links: BrandingLink[];
  onChange: (links: BrandingLink[]) => void;
}) {
  function update(index: number, patch: Partial<BrandingLink>) {
    onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function remove(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }
  function add() {
    if (links.length >= 8) return;
    onChange([...links, { label: "", url: "" }]);
  }

  return (
    <div className="field">
      <label className="label">{title}</label>
      <span className="dropzone-hint" style={{ display: "block", marginBottom: 8 }}>
        {hint}
      </span>
      {links.length > 0 && (
        <ul className="file-list" style={{ marginBottom: 8 }}>
          {links.map((link, i) => (
            <li key={i} className="file-item" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ maxWidth: 140 }}
                placeholder="Label"
                value={link.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <input
                className="input"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => update(i, { url: e.target.value })}
              />
              <button type="button" className="file-item-remove" onClick={() => remove(i)} aria-label="Remove link">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-sm" onClick={add} disabled={links.length >= 8}>
        + Add link
      </button>
    </div>
  );
}

export function BrandingSettings() {
  const { branding, refreshBranding } = useBranding();
  const [appName, setAppName] = useState(branding.appName);
  const [logoText, setLogoText] = useState(branding.logoText);
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor);
  const [defaultCurrency, setDefaultCurrency] = useState(branding.defaultCurrency);
  const [headerLinks, setHeaderLinks] = useState<BrandingLink[]>(branding.headerLinks);
  const [footerLinks, setFooterLinks] = useState<BrandingLink[]>(branding.footerLinks);
  const [footerText, setFooterText] = useState(branding.footerText ?? "");
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    setAppName(branding.appName);
    setLogoText(branding.logoText);
    setPrimaryColor(branding.primaryColor);
    setDefaultCurrency(branding.defaultCurrency);
    setHeaderLinks(branding.headerLinks);
    setFooterLinks(branding.footerLinks);
    setFooterText(branding.footerText ?? "");
  }, [branding]);

  useEffect(() => {
    api.get<{ currencies: string[] }>("/currency").then((res) => setCurrencies(res.currencies));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await api.put("/settings/branding", {
        appName,
        logoText,
        primaryColor,
        defaultCurrency,
        headerLinks: headerLinks.filter((l) => l.label && l.url),
        footerLinks: footerLinks.filter((l) => l.label && l.url),
        footerText: footerText || null,
      });
      await refreshBranding();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save branding");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      await api.post("/settings/branding/logo", formData);
      await refreshBranding();
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : "Failed to upload logo");
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    setLogoError(null);
    try {
      await api.del("/settings/branding/logo");
      await refreshBranding();
    } catch {
      setLogoError("Failed to remove logo");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header">
        <div>
          <h2>Branding</h2>
          <p className="page-subtitle">Customize how the application appears to everyone (Admin only).</p>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Preview</p>
        <div className="app-brand" style={{ marginBottom: 20 }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Company logo" style={{ height: 30, width: "auto" }} />
          ) : (
            <span className="app-brand-mark" style={{ background: primaryColor }}>
              {logoText || "?"}
            </span>
          )}
          {appName || "App name"}
        </div>

        <div className="field">
          <label className="label">Company logo</label>
          {logoError && <div className="alert alert-danger">{logoError}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-sm" onClick={() => logoInputRef.current?.click()} disabled={logoBusy}>
              {branding.logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {branding.logoUrl && (
              <button type="button" className="btn btn-sm btn-danger" onClick={handleLogoRemove} disabled={logoBusy}>
                Remove logo
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={handleLogoUpload}
          />
          <span className="dropzone-hint">
            PNG, JPEG, WEBP, or SVG, up to 3MB. When no logo is uploaded, the text mark below is used instead.
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Application name</label>
            <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} required />
          </div>
          <div className="field">
            <label className="label">Logo mark (fallback text, 1-4 characters)</label>
            <input className="input" value={logoText} onChange={(e) => setLogoText(e.target.value)} maxLength={4} required />
          </div>
          <div className="field">
            <label className="label">Primary color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--color-border)", borderRadius: 6 }}
              />
              <input
                className="input"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                maxLength={7}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">Default currency</label>
            <select className="select" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
              {(currencies.length > 0 ? currencies : [defaultCurrency]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="dropzone-hint">
              Used as the default for new users and claims when no other currency is specified.
            </span>
          </div>

          <LinkListEditor
            title="Header links"
            hint="Shown alongside the app name in the top bar (e.g. Company Intranet, Support)."
            links={headerLinks}
            onChange={setHeaderLinks}
          />

          <LinkListEditor
            title="Footer links"
            hint="Shown in the page footer (e.g. Privacy Policy, Terms, Contact HR)."
            links={footerLinks}
            onChange={setFooterLinks}
          />

          <div className="field">
            <label className="label">Footer text</label>
            <textarea
              className="textarea"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              maxLength={300}
              placeholder="e.g. © 2026 Acme Corp. All rights reserved."
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {saved && <div className="alert" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>Branding updated.</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            Save branding
          </button>
        </form>
      </div>
    </div>
  );
}
