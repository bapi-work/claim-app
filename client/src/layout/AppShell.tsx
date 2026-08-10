import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} className={`app-nav-link${active ? " active" : ""}`}>
      {label}
    </Link>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  if (!user) return null;

  const canSeeBackOffice = user.role === "FINANCE" || user.role === "HR" || user.role === "ADMIN";
  const canManageUsers = user.role === "HR" || user.role === "ADMIN";

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header className="app-topbar">
        <div className="app-brand">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} style={{ height: 28, width: "auto" }} />
          ) : (
            <span className="app-brand-mark" style={{ background: branding.primaryColor }}>
              {branding.logoText}
            </span>
          )}
          {branding.appName}
        </div>
        <nav className="app-nav">
          <NavLink to="/" label="My Claims" />
          {(user.role === "MANAGER" || user.role === "FINANCE" || user.role === "HR" || user.role === "ADMIN") && (
            <NavLink to="/approvals" label="Approvals" />
          )}
          {canSeeBackOffice && <NavLink to="/admin/claims" label="All Claims" />}
          {canSeeBackOffice && <NavLink to="/admin/audit-log" label="Audit Log" />}
          {canManageUsers && <NavLink to="/admin/users" label="Users" />}
          {user.role === "ADMIN" && <NavLink to="/admin/branding" label="Branding" />}
          {user.role === "ADMIN" && <NavLink to="/admin/email" label="Email Settings" />}
          {branding.headerLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="app-nav-link">
              {link.label}
            </a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" className="app-user" style={{ textDecoration: "none" }}>
            <div className="app-user-avatar">{initials(user.name)}</div>
            <div className="app-user-meta">
              <span className="app-user-name">{user.name}</span>
              <span className="app-user-role">{user.role}</span>
            </div>
          </Link>
          <button className="btn btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main" style={{ flex: 1 }}>
        <Outlet />
      </main>
      {(branding.footerLinks.length > 0 || branding.footerText) && (
        <footer className="app-footer">
          {branding.footerLinks.length > 0 && (
            <div className="app-footer-links">
              {branding.footerLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          )}
          {branding.footerText && <div className="app-footer-text">{branding.footerText}</div>}
        </footer>
      )}
    </div>
  );
}
