import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        toast.error(e.message || "Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    };
    run();
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
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum usuário encontrado</TableCell>
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