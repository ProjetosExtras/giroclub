import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const NewGroup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserId(session.user.id);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setLoading(true);

    try {
      // Create group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName,
          created_by: userId,
          status: "active",
          current_cycle: 1,
          max_members: 5,
          deposit_amount: 100,
          weekly_payment: 80,
          payout_amount: 300,
          service_fee_percent: 5,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as first member
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupData.id,
          profile_id: userId,
          position: 1,
        });

      if (memberError) throw memberError;

      toast.success("Grupo criado com sucesso!");
      navigate(`/groups/${groupData.id}`);
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error.message || "Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Criar Novo Grupo</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Grupo</CardTitle>
            <CardDescription>
              Crie um novo grupo de empréstimo rotativo com até 5 membros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="groupName">Nome do Grupo</Label>
                <Input
                  id="groupName"
                  type="text"
                  placeholder="Ex: Grupo dos Amigos"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Escolha um nome que identifique seu grupo facilmente
                </p>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="mb-3 font-semibold text-foreground">Regras do Grupo</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Máximo de 5 membros por grupo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Cada membro deposita R$ 100,00 inicialmente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>A cada semana, um membro recebe R$ 300,00</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Após receber, pagar R$ 80,00 por semana durante 4 semanas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary">•</span>
                    <span>Taxa de serviço de 5% sobre transações</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/dashboard")}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Grupo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 border-secondary/20 bg-secondary/5">
          <CardContent className="pt-6">
            <h3 className="mb-2 font-semibold text-foreground">
              Próximos passos após criar o grupo:
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">1.</span>
                <span>Convide 4 amigos para participar do grupo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">2.</span>
                <span>Todos os membros fazem o depósito inicial de R$ 100,00</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">3.</span>
                <span>Defina a ordem de recebimento dos membros</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">4.</span>
                <span>Acompanhe os pagamentos semanais de cada membro</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NewGroup;