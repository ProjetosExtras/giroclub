import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Request = {
  id: string;
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

const AdminRequests = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Request[]>([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("id,is_admin")
        .eq("id", session.user.id)
        .single();
      if (meError) throw meError;
      if (!me?.is_admin) {
        navigate("/dashboard");
        return;
      }
      const { data, error } = await supabase
        .from("loan_requests")
        .select("id,user_id,full_name,cpf,amount,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.cpf || "").includes(q) ||
      (p.status || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("loan_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "approved" ? "Solicitação aprovada" : "Solicitação reprovada");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
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
          <h1 className="text-2xl font-bold text-foreground">Admin • Solicitações</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Voltar</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Solicitações de empréstimo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Input placeholder="Buscar por nome, CPF ou status" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Solicitado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name || ""}</TableCell>
                        <TableCell>{r.cpf || ""}</TableCell>
                        <TableCell>{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</TableCell>
                        <TableCell>{r.status || ""}</TableCell>
                        <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "approved")}>Aprovar</Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, "rejected")}>Reprovar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma solicitação</TableCell>
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

export default AdminRequests;