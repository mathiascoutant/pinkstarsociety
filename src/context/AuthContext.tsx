import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setToken } from "../lib/api";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "client" | "admin";
  loyaltyPoints?: number;
  /** Présent pour tout compte (client ou admin) après login /me */
  qrToken?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (p: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
    loyaltyCode?: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("pss_token");
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (p: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      passwordConfirm: string;
      loyaltyCode?: string;
    }) => {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(p),
      });
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, login, register, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth hors AuthProvider");
  return v;
}
