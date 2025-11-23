import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type SimpleUser = { id: string; full_name: string; cpf: string; email: string | null; created_at: string | null; };
type SimpleGroup = { id: string; name: string; status: string | null; created_at: string | null; members?: { count: number }[] };

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ users: 0, admins: 0, groupsActive: 0, groupsCompleted: 0, requestsPending: 0, depositsPending: 0 });
  const [recentUsers, setRecentUsers] = useState<SimpleUser[]>([]);
  const [topGroups, setTopGroups] = useState<SimpleGroup[]>([]);
  const mountedRef = useRef(true);

  const isAbortError = (e: any) => !!e && (e.name === "AbortError" || (typeof e.message === "string" && e.message.toLowerCase().includes("aborted")));

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: me, error: meError } = await supabase.from("profiles").select("id,is_admin").eq("id", session.user.id).single();
      if (meError) throw meError;
      if (!me?.is_admin) { navigate("/dashboard"); return; }

      const usersCountReq = supabase.from("profiles").select("id", { count: "exact", head: true });
      const adminsCountReq = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true);
      const groupsActiveReq = supabase.from("groups").select("id", { count: "exact", head: true }).eq("status", "active");
      const groupsCompletedReq = supabase.from("groups").select("id", { count: "exact", head: true }).eq("status", "completed");
      const requestsPendingReq = supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      const depositsPendingReq = supabase.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending");
      const recentUsersReq = supabase.from("profiles").select("id,full_name,cpf,email,created_at").order("created_at", { ascending: false }).limit(5);
      const topGroupsReq = supabase.from("groups").select("id,name,status,created_at,group_members(count)").order("created_at", { ascending: false }).limit(5);

      const [usersCount, adminsCount, groupsActive, groupsCompleted, requestsPending, depositsPending, recentUsersRes, topGroupsRes] = await Promise.all([
        usersCountReq, adminsCountReq, groupsActiveReq, groupsCompletedReq, requestsPendingReq, depositsPendingReq, recentUsersReq, topGroupsReq,
      ]);

      if (!mountedRef.current) return;
      setCounts({
        users: usersCount.count || 0,
        admins: adminsCount.count || 0,
        groupsActive: groupsActive.count || 0,
        groupsCompleted: groupsCompleted.count || 0,
        requestsPending: requestsPending.count || 0,
        depositsPending: depositsPending.count || 0,
      });
      setRecentUsers((recentUsersRes.data as SimpleUser[]) || []);
      setTopGroups((topGroupsRes.data as SimpleGroup[]) || []);
    } catch (e: any) {
      if (isAbortError(e)) return;
      toast.error(e.message || "Erro ao carregar painel");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Admin • Painel</h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline"><Link to="/admin/users">Usuários</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/groups">Grupos</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/requests">Solicitações</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/finance">Financeira</Link></Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Voltar</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Usuários</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{counts.users}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Admins</span><span className="font-semibold">{counts.admins}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Grupos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Ativos</span><span className="font-semibold">{counts.groupsActive}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Concluídos</span><span className="font-semibold">{counts.groupsCompleted}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Solicitações</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Pendentes</span><span className="font-semibold">{counts.requestsPending}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Depósitos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Pendentes</span><span className="font-semibold">{counts.depositsPending}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 mt-8 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Usuários recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cadastrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell>{u.cpf}</TableCell>
                        <TableCell>{u.email || ""}</TableCell>
                        <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</TableCell>
                      </TableRow>
                    ))}
                    {!recentUsers.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Grupos recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topGroups.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell><Badge variant={g.status === "active" ? "default" : "secondary"}>{g.status || ""}</Badge></TableCell>
                        <TableCell>{Array.isArray(g.members) && g.members[0]?.count != null ? g.members[0].count : ""}</TableCell>
                        <TableCell><Button asChild size="sm" variant="outline"><Link to={`/groups/${g.id}`}>Abrir</Link></Button></TableCell>
                      </TableRow>
                    ))}
                    {!topGroups.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum grupo</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;