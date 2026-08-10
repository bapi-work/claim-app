import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Claim, ChainRole } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { FileDropzone } from "../components/FileDropzone";

const CHAIN_ROLES: ChainRole[] = ["MANAGER", "FINANCE", "HR"];
const ROLE_LABEL: Record<ChainRole, string> = { MANAGER: "Manager", FINANCE: "Finance", HR: "HR (disbursement)" };

function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📄";
  return "📎";
}

export function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const c = await api.get<Claim>(`/claims/${id}`);
    setClaim(c);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!claim) return <p className="page-subtitle">Loading...</p>;

  const isOwner = claim.submitterId === user?.id;
  const isDraft = claim.status === "DRAFT";
  const pendingStep = claim.approvalSteps?.find((s) => s.status === "PENDING");
  const rejectedStep = claim.approvalSteps?.find((s) => s.status === "REJECTED");
  const homeCurrency = claim.submitter?.homeCurrency;
  const showConverted = homeCurrency && homeCurrency !== claim.currency && claim.homeCurrencyAmount !== undefined;
  const canDecide =
    claim.status === "SUBMITTED" &&
    pendingStep &&
    user &&
    (user.role === "ADMIN" ||
      (pendingStep.approverId ? pendingStep.approverId === user.id : pendingStep.approverRole === user.role));

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ claim: Claim; warnings: string[] }>(`/claims/${id}/submit`, {});
      setWarnings(res.warnings || []);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit claim");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (pendingFiles.length === 0 || !id) return;
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        setUploadStatus(`Uploading ${i + 1} of ${pendingFiles.length}...`);
        const formData = new FormData();
        formData.append("file", pendingFiles[i]);
        await api.post(`/claims/${id}/attachments`, formData);
      }
      setPendingFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload attachment");
    } finally {
      setBusy(false);
      setUploadStatus(null);
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && comment.trim().length === 0) {
      setError("A reason is required when rejecting a claim.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/approvals/${id}/decision`, { decision, comment: comment || undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h2>{claim.title}</h2>
          <p className="page-subtitle">
            {claim.type} &middot; {claim.currency} {claim.amount}
            {showConverted && (
              <>
                {" "}
                &middot; ≈ {homeCurrency} {claim.homeCurrencyAmount} (home currency)
              </>
            )}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {claim.status === "REJECTED" && rejectedStep && (
        <div className="alert alert-danger">
          <strong>Claim rejected</strong>
          <p style={{ margin: "4px 0 0 0" }}>
            {(rejectedStep.decidedBy?.name ?? rejectedStep.approver?.name) ?? "An approver"} rejected this claim at
            the {ROLE_LABEL[rejectedStep.approverRole]} stage
            {rejectedStep.decidedAt ? ` on ${new Date(rejectedStep.decidedAt).toLocaleString()}` : ""}.
          </p>
          {rejectedStep.comment ? (
            <p style={{ margin: "4px 0 0 0" }}>
              <strong>Reason:</strong> {rejectedStep.comment}
            </p>
          ) : (
            <p style={{ margin: "4px 0 0 0", fontStyle: "italic" }}>No reason was provided.</p>
          )}
        </div>
      )}
      {claim.status === "PAID" && (
        <div className="alert" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
          <strong>Approved and disbursed</strong>
          <p style={{ margin: "4px 0 0 0" }}>
            This claim has cleared Manager, Finance, and HR approval. Funds have been disbursed.
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Policy warnings</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <p className="section-title">Details</p>
        {claim.description && <p>{claim.description}</p>}
        {claim.submitter && (
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Submitted by {claim.submitter.name} ({claim.submitter.email})
          </p>
        )}
        {claim.selectedManager && (
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Approving manager: {claim.selectedManager.name}
          </p>
        )}
        {isOwner && isDraft && (
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSubmit} disabled={busy}>
            Submit for approval
          </button>
        )}
      </div>

      {!isDraft && (
        <div className="card">
          <p className="section-title">Approval workflow</p>
          <ul className="timeline">
            {CHAIN_ROLES.map((role) => {
              const step = claim.approvalSteps?.find((s) => s.approverRole === role);
              return (
                <li key={role} className="timeline-item">
                  <div className="timeline-action" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {ROLE_LABEL[role]}
                    {step ? <StatusBadge status={step.status} /> : <span className="badge badge-neutral">Not started</span>}
                  </div>
                  {role === "MANAGER" && claim.selectedManager && (
                    <div className="timeline-meta">Assigned to {claim.selectedManager.name}</div>
                  )}
                  {step?.decidedBy && (
                    <div className="timeline-meta">
                      {step.status === "APPROVED" ? "Approved" : "Rejected"} by {step.decidedBy.name}
                      {step.decidedAt ? ` on ${new Date(step.decidedAt).toLocaleString()}` : ""}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <p className="section-title">Bills &amp; invoices</p>
        {claim.attachments && claim.attachments.length > 0 ? (
          <ul className="file-list">
            {claim.attachments.map((a) => (
              <li key={a.id} className="file-item">
                <span className="file-item-icon">{fileIcon(a.filename)}</span>
                <a className="file-item-name" href={`/uploads/${a.storagePath}`} target="_blank" rel="noreferrer">
                  {a.filename}
                </a>
                <span className="file-item-meta">{new Date(a.uploadedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="page-subtitle">No bills or invoices attached yet.</p>
        )}

        {isOwner && isDraft && (
          <div style={{ marginTop: 16 }}>
            <FileDropzone files={pendingFiles} onChange={setPendingFiles} disabled={busy} />
            {pendingFiles.length > 0 && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={handleUpload} disabled={busy}>
                {busy ? uploadStatus ?? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
              </button>
            )}
          </div>
        )}
      </div>

      {canDecide && (
        <div className="card">
          <p className="section-title">Decision ({ROLE_LABEL[pendingStep!.approverRole]} stage)</p>
          <div className="field">
            <label className="label">Comment (required if rejecting)</label>
            <textarea
              className="textarea"
              placeholder="Add a comment — required when rejecting"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <button className="btn btn-success" onClick={() => decide("APPROVED")} disabled={busy} style={{ marginRight: 8 }}>
            {pendingStep!.approverRole === "HR" ? "Approve & disburse" : "Approve"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => decide("REJECTED")}
            disabled={busy || comment.trim().length === 0}
            title={comment.trim().length === 0 ? "Enter a reason before rejecting" : undefined}
          >
            Reject
          </button>
        </div>
      )}

      {claim.auditLogs && claim.auditLogs.length > 0 && (
        <div className="card">
          <p className="section-title">Audit trail</p>
          <ul className="timeline">
            {claim.auditLogs.map((log) => (
              <li key={log.id} className="timeline-item">
                <div className="timeline-action">{log.action.replaceAll("_", " ")}</div>
                <div className="timeline-meta">{new Date(log.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
