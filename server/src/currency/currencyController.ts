import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware";
import { SUPPORTED_CURRENCIES } from "../lib/currency";

export const currencyRouter = Router();

currencyRouter.use(requireAuth);

currencyRouter.get("/", (_req, res) => {
  res.json({ currencies: SUPPORTED_CURRENCIES });
});
