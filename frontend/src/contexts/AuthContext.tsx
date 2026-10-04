import React, { useCallback, useEffect, useState } from "react";
import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearStoredTokens } from "../services/api";
import type { User, UserRole } from "../types";
import { AuthContext } from "./auth-context";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      clearStoredTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem(ACCESS_TOKEN_KEY, res.data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
      await fetchProfile();
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    // Revoke both tokens server-side so a copied token can't outlive the session.
    // Local state is cleared regardless - logout must never get stuck on a network error.
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      }
    } catch {
      // Token already expired/revoked - nothing left to revoke
    } finally {
      clearStoredTokens();
      setUser(null);
    }
  };

  const hasRole = (roles: UserRole[]) => {
    return user ? roles.includes(user.role) : false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
