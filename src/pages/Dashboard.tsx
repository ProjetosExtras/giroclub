import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, LogOut, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  status: string;
  current_cycle: number;
  created_at: string;
  member_count?: number;
  max_members: number;
}

interface Profile {
  full_name: string;
  cpf: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Get groups where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", session.user.id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const groupIds = memberData.map(m => m.group_id);
        
        // Get group details
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("*")
          .in("id", groupIds);

        if (groupsError) throw groupsError;

        // Get member count for each group
        const groupsWithCount = await Promise.all(
          (groupsData || []).map(async (group) => {
            const { count } = await supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .eq("group_id", group.id);
            
            return { ...group, member_count: count || 0 };
          })
        );

        setGroups(groupsWithCount);
      }
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      active: "default",
      completed: "secondary",
      cancelled: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status === "active" ? "Ativo" : status === "completed" ? "Concluído" : "Cancelado"}
      </Badge>
    );
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">GiroClub</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">CPF: {profile?.cpf}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Grupos ativos</CardDescription>
              <CardTitle className="text-3xl">
                {groups.filter(g => g.status === "active").length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Total de {groups.length} grupos</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ciclo atual</CardDescription>
              <CardTitle className="text-3xl">
                {groups.length > 0 ? Math.max(...groups.map(g => g.current_cycle)) : 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Em andamento</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Participantes</CardDescription>
              <CardTitle className="text-3xl">
                {groups.reduce((acc, g) => acc + (g.member_count || 0), 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Membros totais</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Groups Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Meus Grupos</h2>
          <Button asChild>
            <Link to="/groups/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Link>
          </Button>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nenhum grupo ainda
              </h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Crie seu primeiro grupo e comece a participar do sistema de empréstimo rotativo
              </p>
              <Button asChild>
                <Link to="/groups/new">Criar primeiro grupo</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.id} className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    {getStatusBadge(group.status)}
                  </div>
                  <CardDescription>Ciclo {group.current_cycle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Membros</span>
                      <span className="font-medium">
                        {group.member_count}/{group.max_members}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${((group.member_count || 0) / group.max_members) * 100}%`,
                        }}
                      />
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/groups/${group.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;