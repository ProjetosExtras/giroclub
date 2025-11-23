import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Payment = {
  id: string;
  group_id: string;
  amount: number;
  status: string;
  week_number: number;
  due_date: string;
  paid_at: string | null;
  created_at: string | null;
  payer: { profile: { full_name: string } } | null;
  group: { name: string; service_fee_percent: number | null } | null;
};

const AdminFinance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const formatCurrency = (n?: number | null) => (typeof n === "number" ? n.toFixed(2) : "0.00");

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("id,is_admin")
        .eq("id", session.user.id)
        .single();
      if (meError) throw meError;
      if (!me?.is_admin) { navigate("/dashboard"); return; }

      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          group_id,
          amount,
          status,
          week_number,
          due_date,
          paid_at,
          created_at,
          payer:group_members(profile:profiles(full_name)),
          group:groups(name,service_fee_percent)
        `)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setItems((data as Payment[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter !== "all") list = list.filter(i => i.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(i =>
      (i.group?.name || "").toLowerCase().includes(q) ||
      (i.payer?.profile?.full_name || "").toLowerCase().includes(q)
    );
  }, [items, statusFilter, query]);

  const totals = useMemo(() => {
    const sum = (arr: Payment[], status?: string) => arr.reduce((acc, p) => acc + (status ? (p.status === status ? p.amount : 0) : p.amount), 0);
    const paid = sum(items, "paid");
    const pending = sum(items, "pending");
    const late = sum(items, "late");
    const failed = sum(items, "failed");
    const revenuePaid = items.reduce((acc, p) => acc + (p.status === "paid" ? (p.group?.service_fee_percent ? p.amount * (p.group.service_fee_percent / 100) : 0) : 0), 0);
    const revenueProjected = items.reduce((acc, p) => acc + (p.status === "pending" || p.status === "late" ? (p.group?.service_fee_percent ? p.amount * (p.group.service_fee_percent / 100) : 0) : 0), 0);
    return { paid, pending, late, failed, revenuePaid, revenueProjected, all: sum(items) };
  }, [items]);

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
          <h1 className="text-2xl font-bold text-foreground">Admin • Financeira</h1>
          <Button variant="outline" onClick={() => navigate("/admin")}>Voltar</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total recebido</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.paid)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total pendente</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.pending)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total em atraso</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.late)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total geral</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.all)}</p></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-8">
          <Card>
            <CardHeader><CardTitle>Rentabilidade realizada</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.revenuePaid)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Rentabilidade projetada</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">R$ {formatCurrency(totals.revenueProjected)}</p></CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Concluídos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="late">Em atraso</SelectItem>
                  <SelectItem value="failed">Falhados</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Buscar por grupo ou pagador" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Semana</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.group?.name || ""}</TableCell>
                      <TableCell>{p.payer?.profile?.full_name || ""}</TableCell>
                      <TableCell>{p.week_number}</TableCell>
                      <TableCell>{`R$ ${formatCurrency(p.amount)}`}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "pending" ? "secondary" : p.status === "late" ? "destructive" : "outline"} className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.due_date ? new Date(p.due_date).toLocaleDateString() : ""}</TableCell>
                      <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum pagamento</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminFinance;