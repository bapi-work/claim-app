import { Router } from "express";
import { z } from "zod";
import { authenticator } from "otplib";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword } from "./passwordUtils";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "../lib/jwt";
import { requireAuth, AuthedRequest } from "./authMiddleware";
import { getDefaultCurrency } from "../lib/currency";

export const authRouter = Router();

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  managerId: string | null;
  homeCurrency: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    managerId: user.managerId,
    homeCurrency: user.homeCurrency,
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "EMPLOYEE", homeCurrency: await getDefaultCurrency() },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  res.status(201).json({ accessToken, refreshToken, user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.twoFactorEnabled) {
    const challengeToken = signTwoFactorChallenge(user.id);
    return res.json({ requiresTwoFactor: true, challengeToken });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  res.json({ accessToken, refreshToken, user: publicUser(user) });
});

const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(1),
  token: z.string().min(6).max(6),
});

authRouter.post("/2fa/login-verify", async (req, res) => {
  const parsed = twoFactorLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let userId: string;
  try {
    userId = verifyTwoFactorChallenge(parsed.data.challengeToken).sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired challenge token" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(409).json({ error: "Two-factor authentication is not enabled for this account" });
  }

  const valid = authenticator.check(parsed.data.token, user.twoFactorSecret);
  if (!valid) return res.status(401).json({ error: "Invalid verification code" });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  res.json({ accessToken, refreshToken, user: publicUser(user) });
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string") {
    return res.status(400).json({ error: "refreshToken is required" });
  }
  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
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
