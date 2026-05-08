import AppProviders from "./AppProviders";
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ProcessFlow — Pipeline Intelligence",
  description: "Gestão inteligente de leads e automação de funil de vendas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-slate-950 text-slate-200 min-h-screen selection:bg-blue-500/30">
        <AppProviders>
          <Header />
          <main className="relative">{children}</main>
        </AppProviders>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(24, 24, 27, 0.96)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              backdropFilter: "blur(20px)",
              color: "#fafafa",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "0.875rem",
            },
          }}
        />
      </body>
    </html>
  );
}
