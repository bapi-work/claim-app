import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "EMPLOYEE" | "MANAGER" | "FINANCE" | "HR" | "ADMIN";
  department?: string | null;
  homeCurrency?: string;
  managerId?: string | null;
}

interface ImportResult {
  created: { email: string; tempPassword?: string }[];
  skipped: { email: string; reason: string }[];
}

const ROLES: AdminUser["role"][] = ["EMPLOYEE", "MANAGER", "FINANCE", "HR", "ADMIN"];
const IMPORT_TEMPLATE = "email,name,role,department,homeCurrency,managerEmail,password\n";

export function UserManagement() {
  const { user: actor } = useAuth();
  const { branding } = useBranding();
  const assignableRoles = actor?.role === "ADMIN" ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "HR");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("EMPLOYEE");
  const [department, setDepartment] = useState("");
  const [homeCurrency, setHomeCurrency] = useState(branding.defaultCurrency);
  const [managerId, setManagerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setHomeCurrency(branding.defaultCurrency);
  }, [branding.defaultCurrency]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function load() {
    const data = await api.get<AdminUser[]>("/users");
    setUsers(data);
  }

  useEffect(() => {
    load();
    api.get<{ currencies: string[] }>("/currency").then((res) => setCurrencies(res.currencies));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/users", {
        email,
        password,
        name,
        role,
        department: department || undefined,
        homeCurrency,
        managerId: managerId || undefined,
      });
      setEmail("");
      setName("");
      setPassword("");
      setDepartment("");
      setManagerId("");
      setRole("EMPLOYEE");
      setHomeCurrency(branding.defaultCurrency);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateUser(id: string, patch: Partial<Pick<AdminUser, "role" | "managerId" | "homeCurrency">>) {
    await api.patch(`/users/${id}`, patch);
    await load();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post<ImportResult>("/users/import", formData);
      setImportResult(result);
      await load();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : "Failed to import users");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const managers = users.filter((u) => u.role === "MANAGER" || u.role === "ADMIN");

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Users</h2>
          <p className="page-subtitle">Manage roles, home currency, and reporting lines.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={downloadTemplate} type="button">
            Download CSV template
          </button>
          <button className="btn btn-primary" onClick={() => importInputRef.current?.click()} disabled={importing}>
            {importing ? "Importing..." : "Import Users"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {importError && <div className="alert alert-danger">{importError}</div>}
      {importResult && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="section-title">Import result</p>
          <p>
            {importResult.created.length} created, {importResult.skipped.length} skipped.
          </p>
          {importResult.created.length > 0 && (
            <>
              <p style={{ fontWeight: 600, fontSize: 13 }}>Created (temporary passwords for accounts without one in the CSV):</p>
              <ul className="file-list">
                {importResult.created.map((c) => (
                  <li key={c.email} className="file-item">
                    <span className="file-item-name">{c.email}</span>
                    {c.tempPassword && (
                      <span className="badge badge-info">temp password: {c.tempPassword}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {importResult.skipped.length > 0 && (
            <>
              <p style={{ fontWeight: 600, fontSize: 13, marginTop: 12 }}>Skipped:</p>
              <ul className="file-list">
                {importResult.skipped.map((s, i) => (
                  <li key={`${s.email}-${i}`} className="file-item">
                    <span className="file-item-name">{s.email}</span>
                    <span className="file-item-meta">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Home currency</th>
                <th>Manager</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="select"
                      value={u.role}
                      disabled={(u.role === "ADMIN" || u.role === "HR") && actor?.role !== "ADMIN"}
                      onChange={(e) => updateUser(u.id, { role: e.target.value as AdminUser["role"] })}
                    >
                      {(assignableRoles.includes(u.role) ? assignableRoles : [...assignableRoles, u.role]).map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        )
                      )}
                    </select>
                  </td>
                  <td>{u.department}</td>
                  <td>
                    <select
                      className="select"
                      value={u.homeCurrency ?? "USD"}
                      onChange={(e) => updateUser(u.id, { homeCurrency: e.target.value })}
                    >
                      {(currencies.length > 0 ? currencies : [u.homeCurrency ?? "USD"]).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={u.managerId ?? ""}
                      onChange={(e) => updateUser(u.id, { managerId: e.target.value || null })}
                    >
                      <option value="">None</option>
                      {managers
                        .filter((m) => m.id !== u.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 440 }}>
        <p className="section-title">Add user</p>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label className="label">Role</label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}>
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Department</label>
              <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
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
            <div className="field">
              <label className="label">Manager</label>
              <select className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            Create user
          </button>
        </form>
      </div>
    </div>
  );
}
