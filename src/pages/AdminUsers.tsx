import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  id: string;
  full_name: string;
  cpf: string;
  email: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type Membership = {
  profile_id: string;
  group: {
    id: string;
    name: string;
    status?: string | null;
  } | null;
  position?: number | null;
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [memberMap, setMemberMap] = useState<Record<string, { id: string; name: string; status: string | null; position: number | null }[]>>({});

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }
        const { data: me, error: meError } = await supabase
          .from("profiles")
          .select("id,is_admin")
          .abortSignal(controller.signal)
          .eq("id", session.user.id)
          .single();
        if (meError) throw meError;
        if (!me?.is_admin) {
          navigate("/dashboard");
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name,cpf,email,is_admin,created_at")
          .abortSignal(controller.signal)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const list = data || [];
        setProfiles(list);

        // Load memberships for listed profiles
        const ids = list.map(p => p.id);
        if (ids.length) {
          const { data: memberships, error: mErr } = await supabase
            .from("group_members")
            .select("profile_id, position, group:groups(id,name,status)")
            .abortSignal(controller.signal)
            .in("profile_id", ids);
          if (!mErr && memberships) {
            const map: Record<string, { id: string; name: string; status: string | null; position: number | null }[]> = {};
            (memberships as Membership[]).forEach(m => {
              if (m.group) {
                map[m.profile_id] = map[m.profile_id] || [];
                map[m.profile_id].push({ id: m.group.id, name: m.group.name, status: m.group.status ?? null, position: m.position ?? null });
              }
            });
            setMemberMap(map);
          }
        }
      } catch (e: any) {
        const msg = String(e?.message || "").toLowerCase();
        if (msg.includes("abort")) return;
        toast.error(e.message || "Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => { controller.abort(); };
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.cpf || "").includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  }, [profiles, query]);

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
          <h1 className="text-2xl font-bold text-foreground">Admin • Usuários</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Voltar</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Input placeholder="Buscar por nome, CPF ou email" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Grupo(s)</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.full_name}</TableCell>
                        <TableCell>{p.cpf}</TableCell>
                        <TableCell>{p.email || ""}</TableCell>
                        <TableCell>{p.is_admin ? "Sim" : "Não"}</TableCell>
                        <TableCell>
                          {memberMap[p.id]?.length ? (
                            memberMap[p.id].map((g, idx) => (
                              <span key={`${g.id}-${g.position}`}>
                                <Link className="hover:underline" to={`/groups/${g.id}`}>{g.name}</Link>
                                {g.position ? ` (pos. ${g.position})` : ""}
                                {g.status ? ` • ${g.status}` : ""}
                                {idx < memberMap[p.id].length - 1 ? ", " : ""}
                              </span>
                            ))
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{p.full_name}</DialogTitle>
                                <DialogDescription>Detalhes do usuário</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">CPF</span>
                                  <span className="font-medium">{p.cpf}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Email</span>
                                  <span className="font-medium">{p.email || ""}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Admin</span>
                                  <span className="font-medium">{p.is_admin ? "Sim" : "Não"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Desde</span>
                                  <span className="font-medium">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Grupo(s)</span>
                                  <div className="mt-1">
                                    {memberMap[p.id]?.length ? (
                                      memberMap[p.id].map((g, idx) => (
                                        <div key={`${g.id}-${g.position}`} className="text-sm">
                                          <Link className="hover:underline" to={`/groups/${g.id}`}>{g.name}</Link>
                                          {g.position ? ` (pos. ${g.position})` : ""}
                                          {g.status ? ` • ${g.status}` : ""}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-sm">—</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="secondary">Fechar</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum usuário encontrado</TableCell>
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

export default AdminUsers;