import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./auth/authController";
import { usersRouter } from "./users/usersController";
import { claimsRouter } from "./claims/claimController";
import { approvalsRouter } from "./approvals/approvalController";
import { adminRouter } from "./admin/adminController";
import { currencyRouter } from "./currency/currencyController";
import { profileRouter } from "./profile/profileController";
import { directoryRouter } from "./directory/directoryController";
import { brandingRouter } from "./settings/brandingController";
import { emailSettingsRouter } from "./settings/emailSettingsController";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/claims", claimsRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/currency", currencyRouter);
app.use("/api/profile", profileRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/settings/branding", brandingRouter);
app.use("/api/settings/email", emailSettingsRouter);

app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`claim-app server listening on port ${port}`);
});
