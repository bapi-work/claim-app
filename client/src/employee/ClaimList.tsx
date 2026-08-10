import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Claim } from "../types";
import { StatusBadge } from "../components/StatusBadge";

export function ClaimList() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Claim[]>("/claims")
      .then(setClaims)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Claims</h2>
          <p className="page-subtitle">Track the status of expenses you've submitted.</p>
        </div>
        <div className="page-actions">
          <Link to="/claims/new">
            <button className="btn btn-primary">+ New Claim</button>
          </Link>
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
                <div className="empty-state-icon">🧾</div>
                <p>No claims yet. Create your first one to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
