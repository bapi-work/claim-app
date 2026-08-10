import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ApprovalStep } from "../types";

export function ApprovalQueue() {
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ApprovalStep[]>("/approvals/queue")
      .then(setSteps)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Approval Queue</h2>
          <p className="page-subtitle">Claims waiting on your decision.</p>
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
                  <th>Stage</th>
                  <th>Submitter</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="badge badge-info">{s.approverRole}</span>
                    </td>
                    <td>{s.claim?.submitter?.name}</td>
                    <td>
                      <Link to={`/claims/${s.claimId}`}>{s.claim?.title}</Link>
                    </td>
                    <td>{s.claim?.type}</td>
                    <td>
                      {s.claim?.currency} {s.claim?.amount}
                    </td>
                    <td>{s.claim?.submittedAt && new Date(s.claim.submittedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {steps.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <p>Nothing pending approval.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
