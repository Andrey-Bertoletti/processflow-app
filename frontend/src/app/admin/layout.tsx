"use client";

import type { ReactNode } from "react";
import RequireWorkspaceAdmin from "@/components/admin/RequireWorkspaceAdmin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireWorkspaceAdmin>{children}</RequireWorkspaceAdmin>;
}
