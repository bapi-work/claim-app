import { Router } from "express";
import { z } from "zod";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword } from "../auth/passwordUtils";
import { requireAuth, AuthedRequest } from "../auth/authMiddleware";
import { isSupportedCurrency } from "../lib/currency";
import { logAudit } from "../lib/audit";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      managerId: true,
      homeCurrency: true,
      twoFactorEnabled: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  homeCurrency: z.string().optional(),
});

profileRouter.patch("/", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.homeCurrency && !isSupportedCurrency(parsed.data.homeCurrency)) {
    return res.status(400).json({ error: `Unsupported currency: ${parsed.data.homeCurrency}` });
  }

  const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  await logAudit({ actorId: req.user!.id, action: "PROFILE_UPDATED" });
  res.json({ id: user.id, name: user.name, homeCurrency: user.homeCurrency });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

profileRouter.post("/password", async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logAudit({ actorId: user.id, action: "PASSWORD_CHANGED" });

  res.json({ ok: true });
});

// --- Two-factor authentication (TOTP) ---

profileRouter.post("/2fa/setup", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.twoFactorEnabled) return res.status(409).json({ error: "Two-factor authentication is already enabled" });

  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

  const otpauthUrl = authenticator.keyuri(user.email, "Claim App", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, qrDataUrl });
});

const verifySchema = z.object({ token: z.string().min(6).max(6) });

profileRouter.post("/2fa/verify", async (req: AuthedRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.twoFactorSecret) {
    return res.status(409).json({ error: "Run 2FA setup first" });
  }

  const valid = authenticator.check(parsed.data.token, user.twoFactorSecret);
  if (!valid) return res.status(401).json({ error: "Invalid verification code" });

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await logAudit({ actorId: user.id, action: "TWO_FACTOR_ENABLED" });

  res.json({ ok: true });
});

const disableSchema = z.object({ password: z.string().min(1) });

profileRouter.post("/2fa/disable", async (req: AuthedRequest, res) => {
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Password is incorrect" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await logAudit({ actorId: user.id, action: "TWO_FACTOR_DISABLED" });

  res.json({ ok: true });
});
