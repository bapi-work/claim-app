import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken } from "../api/client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "EMPLOYEE" | "MANAGER" | "FINANCE" | "HR" | "ADMIN";
  department?: string | null;
  managerId?: string | null;
  homeCurrency?: string;
  twoFactorEnabled?: boolean;
}

type LoginResult = { requiresTwoFactor: true; challengeToken: string } | { requiresTwoFactor: false };

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactorLogin: (challengeToken: string, token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post<
      { accessToken: string; user: CurrentUser } | { requiresTwoFactor: true; challengeToken: string }
    >("/auth/login", { email, password });

    if ("requiresTwoFactor" in res && res.requiresTwoFactor) {
      return { requiresTwoFactor: true, challengeToken: res.challengeToken };
    }

    setToken((res as { accessToken: string; user: CurrentUser }).accessToken);
    setUser((res as { accessToken: string; user: CurrentUser }).user);
    return { requiresTwoFactor: false };
  }

  async function verifyTwoFactorLogin(challengeToken: string, token: string) {
    const res = await api.post<{ accessToken: string; user: CurrentUser }>("/auth/2fa/login-verify", {
      challengeToken,
      token,
    });
    setToken(res.accessToken);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTwoFactorLogin, refreshUser: loadMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
