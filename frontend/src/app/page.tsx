"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const checkWorkspace = async () => {
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data } = await supabase
        .from("workspace_users")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!data || data.length === 0) {
        router.push("/auth/workspace/create");
      } else {
        router.push("/auth/dashboard");
      }
    };

    if (!loading) {
      checkWorkspace();
    }
  }, [user, loading, router]);

  return <p>Carregando...</p>;
}