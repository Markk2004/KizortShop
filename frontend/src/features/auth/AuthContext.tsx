"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface UserProfile {
  username: string;
  email: string;
  balance: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  authModalOpen: boolean;
  authModalTab: "login" | "register";
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;
  loginDemo: () => void;
  logout: () => void;
}

const defaultUser: UserProfile = {
  username: "Sal***",
  email: "sal***@kaitanstudio.com",
  balance: 250,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Default to false so user can immediately see the new guest state and test logging in
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const openAuthModal = (tab: "login" | "register" = "login") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const loginDemo = () => {
    setUser(defaultUser);
    setIsAuthenticated(true);
    setAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
