import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, QrCode, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  status: string;
  current_cycle: number;
  max_members: number;
  deposit_amount: number;
  weekly_payment: number;
  payout_amount: number;
  service_fee_percent: number;
}

interface Member {
  id: string;
  position: number;
  has_received: boolean;
  received_at: string | null;
  profile: {
    full_name: string;
    cpf: string;
  };
}

interface Deposit {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  member: {
    profile: {
      full_name: string;
    };
  };
}

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [showPixModal, setShowPixModal] = useState(false);

  useEffect(() => {
    checkUser();
  }, [id]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      await loadGroupData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar dados do grupo");
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async () => {
    if (!id) return;

    // Get group details
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();

    if (groupError) throw groupError;
    setGroup(groupData);

    // Get members
    const { data: membersData, error: membersError } = await supabase
      .from("group_members")
      .select(`
        id,
        position,
        has_received,
        received_at,
        profile:profiles(full_name, cpf)
      `)
      .eq("group_id", id)
      .order("position");

    if (membersError) throw membersError;
    setMembers(membersData || []);

    // Get deposits
    const { data: depositsData, error: depositsError } = await supabase
      .from("deposits")
      .select(`
        id,
        amount,
        status,
        created_at,
        member:group_members(profile:profiles(full_name))
      `)
      .eq("group_id", id)
      .order("created_at", { ascending: false });

    if (depositsError) throw depositsError;
    setDeposits(depositsData || []);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      confirmed: "text-secondary",
      pending: "text-yellow-500",
      failed: "text-destructive",
    };
    return colors[status as keyof typeof colors] || "text-muted-foreground";
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      confirmed: <CheckCircle2 className="h-4 w-4" />,
      pending: <Clock className="h-4 w-4" />,
      failed: <AlertCircle className="h-4 w-4" />,
    };
    return icons[status as keyof typeof icons] || <Clock className="h-4 w-4" />;
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

  if (!group) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Grupo não encontrado</h2>
          <Button asChild>
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
            <p className="text-sm text-muted-foreground">Ciclo {group.current_cycle}</p>
          </div>
          <Badge variant={group.status === "active" ? "default" : "secondary"}>
            {group.status === "active" ? "Ativo" : "Concluído"}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Group Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Members */}
            <Card>
              <CardHeader>
                <CardTitle>Membros do Grupo</CardTitle>
                <CardDescription>
                  {members.length} de {group.max_members} membros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.profile.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {member.profile.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Posição {member.position}
                          </p>
                        </div>
                      </div>
                      {member.has_received ? (
                        <Badge variant="secondary">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Recebeu
                        </Badge>
                      ) : (
                        <Badge variant="outline">Aguardando</Badge>
                      )}
                    </div>
                  ))}
                  
                  {members.length < group.max_members && (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {group.max_members - members.length} vagas disponíveis
                      </p>
                      <Button variant="outline" size="sm">
                        Convidar membros
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Deposits */}
            <Card>
              <CardHeader>
                <CardTitle>Depósitos Recentes</CardTitle>
                <CardDescription>Histórico de transações do grupo</CardDescription>
              </CardHeader>
              <CardContent>
                {deposits.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum depósito registrado ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deposits.map((deposit) => (
                      <div
                        key={deposit.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={getStatusColor(deposit.status)}>
                            {getStatusIcon(deposit.status)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              R$ {deposit.amount.toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {deposit.member?.profile?.full_name || "Desconhecido"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="capitalize">
                            {deposit.status === "confirmed"
                              ? "Confirmado"
                              : deposit.status === "pending"
                              ? "Pendente"
                              : "Falhou"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(deposit.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions & Info */}
          <div className="space-y-6">
            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle>Valores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Depósito inicial</span>
                  <span className="font-semibold">R$ {group.deposit_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor recebido</span>
                  <span className="font-semibold text-secondary">
                    R$ {group.payout_amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pagamento semanal</span>
                  <span className="font-semibold">R$ {group.weekly_payment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Taxa de serviço</span>
                  <span className="font-semibold">{group.service_fee_percent}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full gap-2" onClick={() => setShowPixModal(true)}>
                  <QrCode className="h-4 w-4" />
                  Fazer depósito via Pix
                </Button>
                <Button variant="outline" className="w-full">
                  Ver meus pagamentos
                </Button>
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card className="border-secondary/20 bg-secondary/5">
              <CardHeader>
                <CardTitle className="text-base">Status do Grupo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Membros que receberam</span>
                  <span className="font-semibold">
                    {members.filter(m => m.has_received).length}/{members.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depósitos confirmados</span>
                  <span className="font-semibold">
                    {deposits.filter(d => d.status === "confirmed").length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Pix Modal (Simulation) */}
      {showPixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Pagamento via Pix</CardTitle>
              <CardDescription>Simulação de pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
                <div className="h-48 w-48 bg-background rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-32 w-32 text-muted-foreground" />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  QR Code de pagamento (simulação)
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Valor: R$ {group.deposit_amount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  * Esta é uma simulação. Em produção, seria integrado com gateway de pagamento real.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPixModal(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast.success("Pagamento simulado com sucesso!");
                    setShowPixModal(false);
                  }}
                >
                  Simular pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;