import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

type Request = {
  id: string;
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

const DetailsContent = ({ userId }: { userId: string }) => {
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ selfie?: string | null; rgFront?: string | null; rgBack?: string | null; cpfFront?: string | null }>({});

  const cleanPhone = (p?: string | null) => (p || "").replace(/\D/g, "");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled) setPhone(profile?.phone || null);

        const bucket = supabase.storage.from("kyc");
        const { data: files } = await bucket.list(`profiles/${userId}`);
        const list = Array.isArray(files) ? files : [];
        const next: { selfie?: string | null; rgFront?: string | null; rgBack?: string | null; cpfFront?: string | null } = {};
        const makeUrl = async (name: string) => {
          const { data } = await bucket.createSignedUrl(`profiles/${userId}/${name}`, 3600);
          return data?.signedUrl || null;
        };
        for (const f of list) {
          const n = f.name || "";
          if (n.startsWith("selfie_")) next.selfie = await makeUrl(n);
          else if (n.startsWith("rg_front_")) next.rgFront = await makeUrl(n);
          else if (n.startsWith("rg_back_")) next.rgBack = await makeUrl(n);
          else if (n.startsWith("cpf_front_")) next.cpfFront = await makeUrl(n);
        }
        if (!cancelled) setUrls(next);
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">WhatsApp</span>
        <span className="font-medium">{phone || ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Selfie</span>
          {urls.selfie ? (
            <img src={urls.selfie} alt="Selfie" className="mt-1 h-32 w-full object-cover rounded" />
          ) : (
            <div className="mt-1 h-32 w-full rounded bg-muted" />
          )}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">RG (frente)</span>
          {urls.rgFront ? (
            <img src={urls.rgFront} alt="RG frente" className="mt-1 h-32 w-full object-cover rounded" />
          ) : (
            <div className="mt-1 h-32 w-full rounded bg-muted" />
          )}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">RG (verso)</span>
          {urls.rgBack ? (
            <img src={urls.rgBack} alt="RG verso" className="mt-1 h-32 w-full object-cover rounded" />
          ) : (
            <div className="mt-1 h-32 w-full rounded bg-muted" />
          )}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">CPF</span>
          {urls.cpfFront ? (
            <img src={urls.cpfFront} alt="CPF" className="mt-1 h-32 w-full object-cover rounded" />
          ) : (
            <div className="mt-1 h-32 w-full rounded bg-muted" />
          )}
        </div>
      </div>
      {phone ? (
        <a href={`https://wa.me/${cleanPhone(phone)}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Abrir WhatsApp</a>
      ) : null}
      {loadingDocs ? (<div className="text-sm text-muted-foreground">Carregando documentos...</div>) : null}
    </div>
  );
};

const AdminRequests = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Request[]>([]);
  const [query, setQuery] = useState("");

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
        .from("loan_requests")
        .select("id,user_id,full_name,cpf,amount,status,created_at")
        .abortSignal(signal as AbortSignal)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("abort")) return;
      toast.error(e.message || "Erro ao carregar solicitações");
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
    return items.filter(p =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.cpf || "").includes(q) ||
      (p.status || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const active = useMemo(() => filtered.filter(r => r.status === "pending" || r.status === "approved"), [filtered]);
  const rejected = useMemo(() => filtered.filter(r => r.status === "rejected"), [filtered]);

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
            <CardTitle>Solicitações de empréstimo (pendentes e aprovadas)</CardTitle>
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
                    {active.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name || ""}</TableCell>
                        <TableCell>{r.cpf || ""}</TableCell>
                        <TableCell>{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</TableCell>
                        <TableCell>{r.status || ""}</TableCell>
                        <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "approved")}>Aprovar</Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive">Reprovar</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reprovar solicitação</DialogTitle>
                                  <DialogDescription>Verifique os detalhes antes de confirmar.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Nome</span>
                                    <span className="font-medium">{r.full_name || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">CPF</span>
                                    <span className="font-medium">{r.cpf || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Valor</span>
                                    <span className="font-medium">{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-medium">{r.status || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Solicitado</span>
                                    <span className="font-medium">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</span>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button variant="destructive" onClick={() => updateStatus(r.id, "rejected")}>Confirmar reprovação</Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">Ver detalhes</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Detalhes da solicitação</DialogTitle>
                                  <DialogDescription>Informações do pedido de empréstimo.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Nome</span>
                                    <span className="font-medium">{r.full_name || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">CPF</span>
                                    <span className="font-medium">{r.cpf || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Valor</span>
                                    <span className="font-medium">{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-medium">{r.status || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Solicitado</span>
                                    <span className="font-medium">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">ID do usuário</span>
                                    <span className="font-medium">{r.user_id}</span>
                                  </div>
                                </div>
                                <DetailsContent userId={r.user_id} />
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="secondary">Fechar</Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {active.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma solicitação</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
                    {rejected.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name || ""}</TableCell>
                        <TableCell>{r.cpf || ""}</TableCell>
                        <TableCell>{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</TableCell>
                        <TableCell>{r.status || ""}</TableCell>
                        <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">Ver detalhes</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Detalhes da solicitação</DialogTitle>
                                  <DialogDescription>Informações do pedido de empréstimo.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Nome</span>
                                    <span className="font-medium">{r.full_name || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">CPF</span>
                                    <span className="font-medium">{r.cpf || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Valor</span>
                                    <span className="font-medium">{r.amount != null ? `R$ ${r.amount.toFixed(2)}` : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-medium">{r.status || ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Solicitado</span>
                                    <span className="font-medium">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">ID do usuário</span>
                                    <span className="font-medium">{r.user_id}</span>
                                  </div>
                                </div>
                                <DetailsContent userId={r.user_id} />
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="secondary">Fechar</Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rejected.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma reprovada</TableCell>
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