import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Group = {
  id: string;
  name: string;
  status: string | null;
  current_cycle: number | null;
  max_members: number | null;
  deposit_amount: number | null;
  weekly_payment: number | null;
  payout_amount: number | null;
  service_fee_percent: number | null;
  created_at: string | null;
  group_members?: { count: number }[];
};

const AdminGroups = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Group[]>([]);
  const [query, setQuery] = useState("");

  const formatCurrency = (n?: number | null) => (typeof n === "number" ? n.toFixed(2) : "0.00");

  const load = async (signal?: AbortSignal) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("id,is_admin")
        .abortSignal(signal as AbortSignal)
        .eq("id", session.user.id)
        .single();
      if (meError) throw meError;
      if (!me?.is_admin) {
        navigate("/dashboard");
        return;
      }
      const { data, error } = await supabase
        .from("groups")
        .select("id,name,status,current_cycle,max_members,deposit_amount,weekly_payment,payout_amount,service_fee_percent,created_at,group_members(count)")
        .abortSignal(signal as AbortSignal)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("abort")) return;
      toast.error(e.message || "Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => { controller.abort(); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(g =>
      (g.name || "").toLowerCase().includes(q) ||
      (g.status || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const setStatus = async (id: string, status: "active" | "completed") => {
    try {
      const { error } = await supabase
        .from("groups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "active" ? "Grupo ativado" : "Grupo concluído");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar status");
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await supabase.from("payments").delete().eq("group_id", id);
      await supabase.from("deposits").delete().eq("group_id", id);
      await supabase.from("group_members").delete().eq("group_id", id);
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
      toast.success("Grupo excluído");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao excluir grupo");
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Admin • Grupos</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Voltar</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de grupos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Input placeholder="Buscar por nome ou status" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead>Pagamento semanal</TableHead>
                      <TableHead>Recebido</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">
                          <Link to={`/groups/${g.id}`} className="hover:underline">{g.name}</Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={g.status === "active" ? "default" : "secondary"}>{g.status || ""}</Badge>
                        </TableCell>
                        <TableCell>{(Array.isArray(g.group_members) && g.group_members[0]?.count != null ? g.group_members[0].count : 0)}{g.max_members != null ? `/${g.max_members}` : ""}</TableCell>
                        <TableCell>{`R$ ${formatCurrency(g.deposit_amount)}`}</TableCell>
                        <TableCell>{`R$ ${formatCurrency(g.weekly_payment)}`}</TableCell>
                        <TableCell>{`R$ ${formatCurrency(g.payout_amount)}`}</TableCell>
                        <TableCell>{g.service_fee_percent != null ? `${g.service_fee_percent}%` : ""}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setStatus(g.id, "active")}>Ativar</Button>
                            <Button size="sm" variant="destructive" onClick={() => setStatus(g.id, "completed")}>Concluir</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">Excluir</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteGroup(g.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum grupo encontrado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminGroups;