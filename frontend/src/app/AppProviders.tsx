"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./context/AuthContext";
import SupabaseConfigGate from "@/components/config/SupabaseConfigGate";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SupabaseConfigGate>
      <AuthProvider>{children}</AuthProvider>
    </SupabaseConfigGate>
  );
}

