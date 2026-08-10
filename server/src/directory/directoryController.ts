import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/authMiddleware";

export const directoryRouter = Router();

directoryRouter.use(requireAuth);

// Any authenticated user can see the list of managers, to pick an approver when submitting a claim.
directoryRouter.get("/managers", async (_req, res) => {
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });
  res.json(managers);
});
