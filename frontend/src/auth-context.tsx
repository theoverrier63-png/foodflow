import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, clearToken, getToken, saveToken, User } from "./api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: {
    company_name: string;
    siret: string;
    email: string;
    phone: string;
    delivery_address: string;
    password: string;
  }) => Promise<void>;
  signUpSupplier: (body: {
    company_name: string;
    siret: string;
    email: string;
    phone: string;
    delivery_address: string;
    password: string;
    access_code: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        try {
          const u = await api.me();
          setUser(u);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    await saveToken(res.access_token);
    setUser(res.user);
  }, []);

  const signUp = useCallback(async (body: Parameters<AuthCtx["signUp"]>[0]) => {
    const res = await api.register(body);
    await saveToken(res.access_token);
    setUser(res.user);
  }, []);

  const signUpSupplier = useCallback(async (body: Parameters<AuthCtx["signUpSupplier"]>[0]) => {
    const res = await api.registerSupplier(body);
    await saveToken(res.access_token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signUpSupplier, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
