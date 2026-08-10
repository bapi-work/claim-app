import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AuditLog } from "../types";

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuditLog[]>("/admin/audit-log")
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p className="page-subtitle">Every state-changing action, most recent first.</p>
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
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Claim</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{l.actor?.name}</td>
                    <td>
                      <span className="badge badge-neutral">{l.action.replaceAll("_", " ")}</span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {l.claimId ? l.claimId.slice(0, 8) : ""}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                      {l.details ? JSON.stringify(l.details) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📜</div>
                <p>No audit entries yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
