# Claim App (MVP)

Employee claim submission with manager approval and admin/finance/HR back-office management.

## Stack
- `server/` — Node + TypeScript + Express + Prisma + Postgres (JWT auth, RBAC)
- `client/` — React + TypeScript + Vite

## Included
- Auth (email/password, JWT access+refresh) + role-based access control (Employee/Manager/Finance/HR/Admin)
- Two-factor authentication (TOTP via authenticator app), self-service password change, editable profile (name, home currency)
- Claim creation, draft editing, submission with an employee-chosen approving manager
- **3-stage approval chain: Manager → Finance → HR.** HR's approval is final and represents fund disbursement (claim status becomes `PAID`). A rejection at any stage stops the chain immediately.
- Approval decisions require a reason when rejecting a claim
- Email notifications at every submit/approve/reject step, sent to everyone with a stake in the claim so far (submitter, chosen manager, anyone who has already acted on it), plus a heads-up to the next stage's role group when a claim advances
- Receipt/bill/invoice attachment upload (local disk) with drag-and-drop
- Multi-currency support: per-user home currency, currency picker on claims, automatic conversion for reporting (static rate table)
- Bulk user import via CSV (with template download), plus manual user management (roles, manager assignment, home currency)
- Admin: all-claims view with filters, CSV export, audit log viewer
- Configurable company branding — Admin only: app name, uploaded logo image (falls back to a text mark), primary color, default currency, plus header links and footer links/text
- Configurable SMTP email alerts, with a "send test email" button — Admin only
- Audit log on every state-changing action
- Modern, theme-aware (light/dark) UI

## Not included (future work)
SSO, OCR receipt parsing, live FX-rate API (currently a static table), threshold-based routing (e.g. skip a stage under a dollar amount), delegation, payment gateway integration, bulk claim processing, analytics dashboards.

## Setup

```bash
# 1. Start Postgres
docker-compose up -d

# 2. Backend
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev   # http://localhost:4000

# 3. Frontend (new terminal)
cd client
npm install
npm run dev   # http://localhost:5173
```

## Seeded logins
All passwords: `password123`

- admin@example.com (ADMIN)
- hr@example.com (HR)
- manager@example.com (MANAGER)
- employee@example.com (EMPLOYEE, reports to manager@example.com, home currency INR)
- finance@example.com (FINANCE)

## Flow to try
1. Log in as `employee@example.com`, create a claim, pick an approving manager, attach a bill/invoice, submit it.
2. Log in as `manager@example.com`, open Approvals, approve it — it moves to the Finance queue.
3. Log in as `finance@example.com`, approve it — it moves to the HR queue.
4. Log in as `hr@example.com`, approve it — the claim is now `PAID` (disbursed). Try rejecting without a comment at any stage (blocked).
5. Log in as `admin@example.com` (or finance/HR), view All Claims, export CSV, check the audit log — each shows the full Manager → Finance → HR trail.
6. As `admin@example.com`: import users via CSV (Users page), customize Branding (upload a logo, add header/footer links), and configure Email Settings (SMTP) — use "Send test email" to verify.
7. From the profile menu (top-right avatar), any user can change their password or enable two-factor authentication (scan the QR code with an authenticator app).

## Notes
- Currency conversion uses a fixed rate table (`server/src/lib/currency.ts`), not a live FX API — swap that module for a real provider later without touching callers.
- Email sending fails gracefully (logged, not thrown) if SMTP isn't configured or reachable, so it never blocks a claim action.
- HR can manage everyday users but cannot grant the Admin or HR role — only an Admin can do that.
- The Finance and HR approval steps are role-based queues (any user with that role can act), not assigned to a specific person; the Manager step is a specific person the employee chose at submission time. An Admin can override and act at any stage.
- Uploaded branding logos are stored on local disk under `server/uploads/branding/`.
