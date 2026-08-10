import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";
import { requireAuth, requireRole, AuthedRequest } from "../auth/authMiddleware";
import { sendMail } from "../lib/mailer";

export const emailSettingsRouter = Router();

emailSettingsRouter.use(requireAuth, requireRole("ADMIN"));

async function getOrCreate() {
  return prisma.emailSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

emailSettingsRouter.get("/", async (_req, res) => {
  const settings = await getOrCreate();
  res.json({
    enabled: settings.enabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    hasPassword: Boolean(settings.smtpPassword),
    fromName: settings.fromName,
    fromAddress: settings.fromAddress,
  });
});

const updateSchema = z.object({
  enabled: z.boolean(),
  smtpHost: z.string().min(1).optional().nullable(),
  smtpPort: z.number().int().positive().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional(), // omitted/blank = keep existing password
  fromName: z.string().min(1).optional(),
  fromAddress: z.string().email().optional().nullable(),
});

emailSettingsRouter.put("/", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { smtpPassword, ...rest } = parsed.data;

  await getOrCreate();
  const settings = await prisma.emailSettings.update({
    where: { id: "singleton" },
    data: {
      ...rest,
      ...(smtpPassword ? { smtpPassword } : {}),
    },
  });

  await logAudit({ actorId: req.user!.id, action: "EMAIL_SETTINGS_UPDATED" });

  res.json({
    enabled: settings.enabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    hasPassword: Boolean(settings.smtpPassword),
    fromName: settings.fromName,
    fromAddress: settings.fromAddress,
  });
});

emailSettingsRouter.post("/test", async (req: AuthedRequest, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!actor) return res.status(404).json({ error: "User not found" });

  const result = await sendMail({
    to: actor.email,
    subject: "Claim App test email",
    text: "This is a test email from Claim App's SMTP settings. If you received this, your configuration works.",
  });

  await logAudit({ actorId: req.user!.id, action: "EMAIL_TEST_SENT", details: result });

  if (result.sent) {
    res.json({ ok: true });
  } else {
    res.status(422).json({ ok: false, reason: result.reason });
  }
});
