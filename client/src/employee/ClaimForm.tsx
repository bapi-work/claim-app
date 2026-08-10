import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { Claim, ClaimType } from "../types";
import { FileDropzone } from "../components/FileDropzone";

const CLAIM_TYPES: ClaimType[] = ["TRAVEL", "MEDICAL", "SUBSCRIPTION", "MILEAGE", "OTHER"];

interface ManagerOption {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

export function ClaimForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();
  const [type, setType] = useState<ClaimType>("TRAVEL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.homeCurrency ?? branding.defaultCurrency);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ currencies: string[] }>("/currency").then((res) => setCurrencies(res.currencies));
    api.get<ManagerOption[]>("/directory/managers").then(setManagers);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedManagerId) {
      setError("Please select a manager to approve this claim.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const claim = await api.post<Claim>("/claims", {
        type,
        title,
        description: description || undefined,
        amount: Number(amount),
        currency,
        selectedManagerId,
      });

      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Uploading attachment ${i + 1} of ${files.length}...`);
        const formData = new FormData();
        formData.append("file", files[i]);
        await api.post(`/claims/${claim.id}/attachments`, formData);
      }

      navigate(`/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create claim");
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header">
        <div>
          <h2>New Claim</h2>
          <p className="page-subtitle">Fill in the expense details and attach bills or invoices as proof.</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label className="label">Type</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value as ClaimType)}>
                {CLAIM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Currency</label>
              <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {(currencies.length > 0 ? currencies : [currency]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flight to client conference"
              required
            />
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any extra context for your approver"
            />
          </div>

          <div className="field">
            <label className="label">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {user?.homeCurrency && currency !== user.homeCurrency && (
              <span className="dropzone-hint">
                Will be converted to your home currency ({user.homeCurrency}) for reporting.
              </span>
            )}
          </div>

          <div className="field">
            <label className="label">Approving manager</label>
            <select
              className="select"
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              required
            >
              <option value="">Select a manager...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.department ? ` (${m.department})` : ""}
                </option>
              ))}
            </select>
            <span className="dropzone-hint">
              After your manager approves, this claim routes to Finance, then HR for final approval and
              disbursement.
            </span>
          </div>

          <div className="field">
            <label className="label">Bills &amp; invoices</label>
            <FileDropzone files={files} onChange={setFiles} disabled={submitting} />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? uploadStatus ?? "Saving..." : "Save as draft"}
          </button>
        </form>
      </div>
    </div>
  );
}
