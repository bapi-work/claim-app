import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export interface BrandingLink {
  label: string;
  url: string;
}

export interface Branding {
  appName: string;
  logoText: string;
  logoUrl: string | null;
  primaryColor: string;
  defaultCurrency: string;
  headerLinks: BrandingLink[];
  footerLinks: BrandingLink[];
  footerText: string | null;
}

const DEFAULT_BRANDING: Branding = {
  appName: "Claim App",
  logoText: "CA",
  logoUrl: null,
  primaryColor: "#4f46e5",
  defaultCurrency: "USD",
  headerLinks: [],
  footerLinks: [],
  footerText: null,
};

interface BrandingContextValue {
  branding: Branding;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

function applyCssVariable(color: string) {
  document.documentElement.style.setProperty("--color-primary", color);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const refreshBranding = useCallback(async () => {
    try {
      const data = user
        ? await api.get<Branding>("/settings/branding")
        : await api.get<Branding>("/settings/branding/public");
      setBranding(data);
      applyCssVariable(data.primaryColor);
    } catch {
      // fall back to defaults if branding can't be loaded
    }
  }, [user]);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return <BrandingContext.Provider value={{ branding, refreshBranding }}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
