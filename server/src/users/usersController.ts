import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../auth/passwordUtils";
import { requireAuth, requireRole, AuthedRequest } from "../auth/authMiddleware";
import { isSupportedCurrency, getDefaultCurrency } from "../lib/currency";
import { parseCsv } from "../admin/csvParse";
import { logAudit } from "../lib/audit";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN", "HR"));

// HR can manage everyday users but only Admin can grant Admin/HR privileges (avoid HR self-escalating).
function assertRoleAssignable(actingRole: string, targetRole: string | undefined, res: import("express").Response): boolean {
  if (!targetRole) return true;
  if (actingRole === "ADMIN") return true;
  if ((targetRole === "ADMIN" || targetRole === "HR") && actingRole !== "ADMIN") {
    res.status(403).json({ error: "Only an Admin can assign the Admin or HR role" });
    return false;
  }
  return true;
}

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      homeCurrency: true,
      managerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

const ROLE_VALUES = ["EMPLOYEE", "MANAGER", "FINANCE", "HR", "ADMIN"] as const;

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(ROLE_VALUES).default("EMPLOYEE"),
  department: z.string().optional(),
  homeCurrency: z.string().optional(),
  managerId: z.string().uuid().optional().nullable(),
});

usersRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, role, department, homeCurrency, managerId } = parsed.data;

  if (!assertRoleAssignable(req.user!.role, role, res)) return;

  if (homeCurrency && !isSupportedCurrency(homeCurrency)) {
    return res.status(400).json({ error: `Unsupported currency: ${homeCurrency}` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      department,
      homeCurrency: homeCurrency ?? (await getDefaultCurrency()),
      managerId: managerId ?? undefined,
    },
  });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  department: z.string().optional(),
  homeCurrency: z.string().optional(),
  managerId: z.string().uuid().optional().nullable(),
});

usersRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!assertRoleAssignable(req.user!.role, parsed.data.role, res)) return;

  if (parsed.data.homeCurrency && !isSupportedCurrency(parsed.data.homeCurrency)) {
    return res.status(400).json({ error: `Unsupported currency: ${parsed.data.homeCurrency}` });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// Bulk import via CSV: header row + columns email,name,role,department,homeCurrency,managerEmail,password (password optional).
usersRouter.post("/import", csvUpload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No CSV file uploaded" });

  const rows = parseCsv(req.file.buffer.toString("utf-8"));
  if (rows.length === 0) return res.status(400).json({ error: "CSV file is empty" });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const col = (row: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  const created: { email: string; tempPassword?: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  const pendingManagerLinks: { email: string; managerEmail: string }[] = [];
  const orgDefaultCurrency = await getDefaultCurrency();

  for (const row of dataRows) {
    const email = col(row, "email");
    const name = col(row, "name");
    const roleRaw = col(row, "role").toUpperCase() || "EMPLOYEE";
    const department = col(row, "department") || undefined;
    const homeCurrency = col(row, "homecurrency").toUpperCase() || orgDefaultCurrency;
    const managerEmail = col(row, "manageremail");
    const providedPassword = col(row, "password");

    if (!email || !name) {
      skipped.push({ email: email || "(blank)", reason: "Missing email or name" });
      continue;
    }
    if (!ROLE_VALUES.includes(roleRaw as (typeof ROLE_VALUES)[number])) {
      skipped.push({ email, reason: `Invalid role: ${roleRaw}` });
      continue;
    }
    if ((roleRaw === "ADMIN" || roleRaw === "HR") && req.user!.role !== "ADMIN") {
      skipped.push({ email, reason: "Only an Admin can import Admin or HR users" });
      continue;
    }
    if (!isSupportedCurrency(homeCurrency)) {
      skipped.push({ email, reason: `Unsupported currency: ${homeCurrency}` });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      skipped.push({ email, reason: "Already exists" });
      continue;
    }

    const tempPassword = providedPassword || crypto.randomBytes(6).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: roleRaw as (typeof ROLE_VALUES)[number],
        department,
        homeCurrency,
      },
    });

    created.push({ email, tempPassword: providedPassword ? undefined : tempPassword });
    if (managerEmail) pendingManagerLinks.push({ email, managerEmail });
  }

  for (const link of pendingManagerLinks) {
    const manager = await prisma.user.findUnique({ where: { email: link.managerEmail } });
    if (manager) {
      await prisma.user.update({ where: { email: link.email }, data: { managerId: manager.id } });
    } else {
      skipped.push({ email: link.email, reason: `Manager email not found: ${link.managerEmail}` });
    }
  }

  await logAudit({
    actorId: req.user!.id,
    action: "USERS_IMPORTED",
    details: { createdCount: created.length, skippedCount: skipped.length },
  });

  res.json({ created, skipped });
});
