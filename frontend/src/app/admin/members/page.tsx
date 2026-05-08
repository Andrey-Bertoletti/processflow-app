"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import RequireWorkspaceAdmin from "@/components/admin/RequireWorkspaceAdmin";
import { Users, Shield, UserMinus, RefreshCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: "admin" | "member";
  email: string;
  display_name: string;
  joined_at: string;
}

export default function MembersManagementPage() {
  const { activeWorkspaceId, user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const fetchMembers = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_workspace_members", {
        p_workspace_id: activeWorkspaceId,
      });

      if (error) throw error;
      setMembers(data as WorkspaceMember[]);
    } catch (err: any) {
      console.error("Erro ao buscar membros:", err);
      toast.error("Não foi possível carregar a lista de membros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeWorkspaceId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspaceId) return;

    setIsInviting(true);
    try {
      const { data, error } = await (supabase as any).rpc("add_workspace_member_by_email", {
        p_workspace_id: activeWorkspaceId,
        p_email: inviteEmail.trim(),
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setInviteEmail("");
        fetchMembers(); // Recarrega a lista
      } else {
        toast.error(data.message);
      }
    } catch (err: any) {
      console.error("Erro ao adicionar membro:", err);
      toast.error("Falha ao processar solicitação.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "member") => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Proteção: Impedir rebaixar o último admin
    if (member.role === "admin" && newRole === "member") {
      const admins = members.filter((m) => m.role === "admin");
      if (admins.length <= 1) {
        toast.error("O workspace deve ter pelo menos um administrador.");
        return;
      }
    }

    setUpdatingId(memberId);
    try {
      const { error } = await supabase
        .from("workspace_users")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
      
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success(`Papel de ${member.display_name} atualizado para ${newRole}.`);
    } catch (err: any) {
      console.error("Erro ao atualizar papel:", err);
      toast.error("Falha ao atualizar papel do membro.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Proteção: Impedir remover o último admin
    if (member.role === "admin") {
      const admins = members.filter((m) => m.role === "admin");
      if (admins.length <= 1) {
        toast.error("Não é possível remover o único administrador do workspace.");
        return;
      }
    }

    if (!confirm(`Tem certeza que deseja remover ${member.display_name} do workspace?`)) {
      return;
    }

    setUpdatingId(memberId);
    try {
      const { error } = await supabase
        .from("workspace_users")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success(`${member.display_name} foi removido com sucesso.`);
    } catch (err: any) {
      console.error("Erro ao remover membro:", err);
      toast.error("Falha ao remover membro.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <RequireWorkspaceAdmin>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-400" />
              Gestão de Membros
            </h1>
            <p className="text-sm text-zinc-500">
              Gerencie quem tem acesso ao seu workspace e defina permissões.
            </p>
          </div>
          
          <form onSubmit={handleAddMember} className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-white/5">
            <input
              type="email"
              placeholder="Email do novo membro..."
              className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-zinc-600 px-3 w-64"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <Button type="submit" size="sm" isLoading={isInviting} disabled={!inviteEmail.trim()}>
              Adicionar
            </Button>
          </form>
        </header>

        <Surface className="overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Membro</th>
                <th className="px-6 py-4">Papel</th>
                <th className="px-6 py-4">Entrou em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Carregando membros...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{member.display_name}</span>
                        <span className="text-xs text-zinc-500">{member.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {member.role === "admin" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                            Membro
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(member.joined_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          disabled={updatingId === member.id}
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value as "admin" | "member")}
                          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                        >
                          <option value="admin">Tornar Admin</option>
                          <option value="member">Tornar Membro</option>
                        </select>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingId === member.id}
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Surface>

        <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 p-4 border border-blue-500/10">
          <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
          <p className="text-xs text-blue-400/80 leading-relaxed">
            <strong>Dica de Segurança:</strong> Novos usuários adicionados ao workspace entram com o papel de <strong>Membro</strong> por padrão. 
            Apenas administradores podem gerenciar permissões e remover outros usuários.
          </p>
        </div>
      </div>
    </RequireWorkspaceAdmin>
  );
}
