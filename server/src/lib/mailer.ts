import nodemailer from "nodemailer";
import { prisma } from "./prisma";

export async function sendMail(params: { to: string; subject: string; text: string }): Promise<
  { sent: true } | { sent: false; reason: string }
> {
  const settings = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });

  if (!settings || !settings.enabled) {
    return { sent: false, reason: "Email alerts are not enabled" };
  }
  if (!settings.smtpHost || !settings.fromAddress) {
    return { sent: false, reason: "SMTP is not fully configured" };
  }

  try {
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPassword ?? undefined } : undefined,
    });

    await transport.sendMail({
      from: `"${settings.fromName}" <${settings.fromAddress}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });

    return { sent: true };
  } catch (err) {
    // Never let a broken mail server take down a claim action — log and continue.
    console.error("sendMail failed:", err);
    return { sent: false, reason: err instanceof Error ? err.message : "Unknown SMTP error" };
  }
}

export function sendMailToMany(params: { to: string[]; subject: string; text: string }): void {
  const unique = Array.from(new Set(params.to.filter(Boolean)));
  for (const to of unique) {
    // Fire-and-forget: sendMail already catches and logs its own errors.
    void sendMail({ to, subject: params.subject, text: params.text });
  }
}
