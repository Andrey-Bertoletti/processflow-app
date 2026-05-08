"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/app/context/AuthContext";
import useWorkspaceAdmin from "@/hooks/useWorkspaceAdmin";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function userInitials(email: string | undefined) {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, activeWorkspaceId, workspaces, setActiveWorkspaceId } = useAuth();
  const { isAdmin, loading: roleLoading } = useWorkspaceAdmin(
    activeWorkspaceId,
    Boolean(user && activeWorkspaceId)
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = accountRef.current;
      if (el && !el.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [accountOpen]);

  const hideHeader =
    pathname.startsWith("/auth") || pathname.startsWith("/configuration-error");

  if (hideHeader) {
    return null;
  }

  const showAppNav = Boolean(user) && !loading;
  const showAdmin = showAppNav && activeWorkspaceId && !roleLoading && isAdmin;

  const desktopNav = [
    { name: "Pipeline", href: "/pipeline", icon: Briefcase, show: showAppNav },
    { name: "Dashboard", href: "/auth/dashboard", icon: LayoutDashboard, show: showAppNav },
    { name: "Campanhas", href: "/campaigns", icon: Megaphone, show: showAppNav },
    { name: "Admin", href: "/admin", icon: Settings, show: showAdmin },
  ].filter((item) => item.show);

  const activeWorkspaceName =
    workspaces.find((w: { id: string; name?: string }) => w.id === activeWorkspaceId)?.name ?? null;

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setActiveWorkspaceId(null);
      router.push("/auth/login");
      toast.success("Sessão encerrada.");
    } catch {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[rgb(9,9,11)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-8">
          <Link href={user ? "/pipeline" : "/auth/login"} className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-[1.03]">
              <img src="/logo.png" alt="ProcessFlow" className="h-6 w-6 invert brightness-0" />
            </div>
            <span className="hidden text-lg font-semibold tracking-tight text-white sm:inline">
              Process<span className="text-blue-500">Flow</span>
            </span>
          </Link>

          {showAppNav ? (
            <nav className="hidden md:flex items-center gap-0.5">
              {desktopNav.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname.startsWith("/admin")
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                    )}
                  >
                    <item.icon size={17} className={cn(isActive ? "text-blue-400" : "text-zinc-500")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showAppNav && workspaces.length > 0 ? (
            <div className="hidden max-w-[200px] lg:max-w-[240px] lg:flex items-center gap-2">
              <label htmlFor="header-workspace" className="sr-only">
                Trocar workspace
              </label>
              <select
                id="header-workspace"
                className="app-select max-w-full cursor-pointer py-2 pl-3 pr-8 text-xs font-medium text-zinc-200"
                value={activeWorkspaceId ?? ""}
                onChange={(e) => {
                  setActiveWorkspaceId(e.target.value || null);
                }}
              >
                {workspaces.map((w: { id: string; name: string }) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {showAppNav && activeWorkspaceName && workspaces.length <= 1 ? (
            <span
              className="hidden max-w-[160px] truncate rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 lg:inline"
              title={activeWorkspaceName}
            >
              {activeWorkspaceName}
            </span>
          ) : null}

          {showAppNav ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.07]"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-semibold text-white">
                  {userInitials(user?.email)}
                </div>
                <ChevronDown
                  size={14}
                  className={cn("text-zinc-500 transition-transform", accountOpen && "rotate-180")}
                />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950 py-1 shadow-xl"
                >
                  <div className="border-b border-white/[0.06] px-3 py-2">
                    <p className="truncate text-xs text-zinc-500">{user?.email}</p>
                    {activeWorkspaceId && !roleLoading ? (
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                        {isAdmin ? "Admin" : "Membro"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"
                    onClick={() => router.push("/auth/dashboard")}
                  >
                    <LayoutDashboard size={16} className="text-zinc-500" />
                    Dashboard
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} className="text-zinc-500" />
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Entrar
            </Link>
          )}

          {showAppNav ? (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-300 md:hidden"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          ) : null}
        </div>
      </div>

      {showAppNav && mobileOpen ? (
        <nav className="border-t border-white/[0.06] bg-[rgb(9,9,11)]/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {desktopNav.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname.startsWith("/admin")
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium",
                    isActive ? "bg-white/10 text-white" : "text-zinc-400"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </div>
          {workspaces.length > 1 ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">Workspace</p>
              <select
                className="app-select w-full py-2.5 text-sm"
                value={activeWorkspaceId ?? ""}
                onChange={(e) => {
                  setActiveWorkspaceId(e.target.value || null);
                  setMobileOpen(false);
                }}
              >
                {workspaces.map((w: { id: string; name: string }) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
