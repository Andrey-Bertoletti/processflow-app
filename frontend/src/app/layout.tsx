import { AuthProvider } from "./context/AuthContext";
import "./globals.css";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(10, 20, 35, 0.95)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              backdropFilter: "blur(18px)",
              color: "#e5eefb",
              fontFamily: "Inter, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}