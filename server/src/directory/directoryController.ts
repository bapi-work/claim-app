import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../auth/authMiddleware";

export const directoryRouter = Router();

directoryRouter.use(requireAuth);

// Any authenticated user can see this list to pick who should approve their claim.
// Not restricted by role — any colleague can be chosen as the first-stage approver.
directoryRouter.get("/managers", async (req: AuthedRequest, res) => {
  const users = await prisma.user.findMany({
    where: { id: { not: req.user!.id } },
    select: { id: true, name: true, email: true, department: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});
