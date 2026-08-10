import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Claim, ClaimStatus } from "../types";
import { StatusBadge } from "../components/StatusBadge";

const STATUSES: ClaimStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"];

export function AllClaimsTable() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [status, setStatus] = useState<string>("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (department) params.set("department", department);
    const query = params.toString();
    const data = await api.get<Claim[]>(`/admin/claims${query ? `?${query}` : ""}`);
    setClaims(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>All Claims</h2>
          <p className="page-subtitle">Company-wide view for Finance and Admin.</p>
        </div>
        <div className="page-actions">
          <a href="/api/admin/claims/export.csv">
            <button className="btn">Export CSV</button>
          </a>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <label className="label">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label className="label">Department</label>
            <input
              className="input"
              placeholder="e.g. Engineering"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={load}>
            Filter
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="page-subtitle">Loading...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Submitter</th>
                  <th>Department</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.submitter?.name}</td>
                    <td>{c.submitter?.department}</td>
                    <td>
                      <Link to={`/claims/${c.id}`}>{c.title}</Link>
                    </td>
                    <td>{c.type}</td>
                    <td>
                      {c.currency} {c.amount}
                      {c.submitter?.homeCurrency &&
                        c.submitter.homeCurrency !== c.currency &&
                        c.homeCurrencyAmount !== undefined && (
                          <div className="file-item-meta">
                            ≈ {c.submitter.homeCurrency} {c.homeCurrencyAmount}
                          </div>
                        )}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {claims.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p>No claims match these filters.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
