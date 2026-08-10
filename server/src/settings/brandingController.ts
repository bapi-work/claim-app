import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";
import { requireAuth, requireRole, AuthedRequest } from "../auth/authMiddleware";
import { isSupportedCurrency } from "../lib/currency";
import { logoUpload } from "./logoUpload";

export const brandingRouter = Router();

async function getOrCreateBranding() {
  return prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

const linkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().min(1).max(500),
});

function publicShape(branding: Awaited<ReturnType<typeof getOrCreateBranding>>) {
  return {
    appName: branding.appName,
    logoText: branding.logoText,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    defaultCurrency: branding.defaultCurrency,
    headerLinks: branding.headerLinks,
    footerLinks: branding.footerLinks,
    footerText: branding.footerText,
  };
}

// Public (but still requires a logged-in session) so the login/app shell can render branding.
brandingRouter.get("/", requireAuth, async (_req, res) => {
  const branding = await getOrCreateBranding();
  res.json(branding);
});

// Unauthenticated variant for the login screen, before a token exists.
brandingRouter.get("/public", async (_req, res) => {
  const branding = await getOrCreateBranding();
  res.json(publicShape(branding));
});

const updateSchema = z.object({
  appName: z.string().min(1).max(60),
  logoText: z.string().min(1).max(4),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "primaryColor must be a hex color like #4f46e5"),
  defaultCurrency: z.string(),
  headerLinks: z.array(linkSchema).max(8).optional(),
  footerLinks: z.array(linkSchema).max(8).optional(),
  footerText: z.string().max(300).optional().nullable(),
});

brandingRouter.put("/", requireAuth, requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!isSupportedCurrency(parsed.data.defaultCurrency)) {
    return res.status(400).json({ error: `Unsupported currency: ${parsed.data.defaultCurrency}` });
  }

  await getOrCreateBranding();
  const branding = await prisma.appSettings.update({
    where: { id: "singleton" },
    data: parsed.data,
  });

  await logAudit({ actorId: req.user!.id, action: "BRANDING_UPDATED", details: { appName: parsed.data.appName } });

  res.json(branding);
});

brandingRouter.post(
  "/logo",
  requireAuth,
  requireRole("ADMIN"),
  (req, res, next) => {
    logoUpload.single("logo")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || "Invalid logo upload" });
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "No logo file uploaded" });

    const existing = await getOrCreateBranding();
    if (existing.logoUrl) {
      const oldPath = path.join(__dirname, "..", "..", "uploads", "branding", path.basename(existing.logoUrl));
      fs.unlink(oldPath, () => {});
    }

    const logoUrl = `/uploads/branding/${req.file.filename}`;
    const branding = await prisma.appSettings.update({ where: { id: "singleton" }, data: { logoUrl } });

    await logAudit({ actorId: req.user!.id, action: "BRANDING_LOGO_UPLOADED" });

    res.json(branding);
  }
);

brandingRouter.delete("/logo", requireAuth, requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const existing = await getOrCreateBranding();
  if (existing.logoUrl) {
    const oldPath = path.join(__dirname, "..", "..", "uploads", "branding", path.basename(existing.logoUrl));
    fs.unlink(oldPath, () => {});
  }

  const branding = await prisma.appSettings.update({ where: { id: "singleton" }, data: { logoUrl: null } });
  await logAudit({ actorId: req.user!.id, action: "BRANDING_LOGO_REMOVED" });

  res.json(branding);
});
