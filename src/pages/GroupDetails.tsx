import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateBr } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

interface Payment {
  id: string;
  amount: number;
  status: string | null;
  due_date: string;
  paid_at: string | null;
  payer_id: string;
}

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPixModal, setShowPixModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [addCpf, setAddCpf] = useState("");
  const [adding, setAdding] = useState(false);
  const [inviteCpf, setInviteCpf] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteProfileId, setInviteProfileId] = useState<string | null>(null);
  const [inviteProfileName, setInviteProfileName] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestErrorOpen, setRequestErrorOpen] = useState(false);
  const [requestErrorMsg, setRequestErrorMsg] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<number | null>(null);
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [pixNow, setPixNow] = useState<number>(Date.now());

  useEffect(() => {
    let timer: number | null = null;
    if (showPixModal) {
      timer = setInterval(() => setPixNow(Date.now()), 1000) as unknown as number;
    }
    return () => { if (timer) clearInterval(timer as unknown as number); };
  }, [showPixModal]);

  useEffect(() => {
    let interval: number | null = null;
    const run = async () => {
      if (!showPixModal || !pixPaymentId || !pixDeadline) return;
      interval = setInterval(async () => {
        if (!pixDeadline) return;
        if (Date.now() >= pixDeadline) {
          setShowPixModal(false);
          toast.error("Tempo esgotado, transação não concluída");
          if (interval) clearInterval(interval as unknown as number);
          return;
        }
        try {
          type PixStatusData = { status: string | null; status_detail: string | null; amount: number | null };
          const { data, error } = await supabase.functions.invoke<PixStatusData>("pix_status", { body: { id: pixPaymentId } });
          if (error) return;
          const status = data?.status;
          if (status === "approved") {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: member } = await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", id)
                .eq("profile_id", session.user.id)
                .maybeSingle();
              if (member?.id) {
                await supabase.from("deposits").insert({ group_id: id, member_id: member.id, amount: group.deposit_amount, status: "confirmed" });
                await loadGroupData();
              }
            }
            toast.success("Depósito confirmado");
            setShowPixModal(false);
            if (interval) clearInterval(interval as unknown as number);
          }
        } catch (_e) {
          setPixError(null);
        }
      }, 3000) as unknown as number;
    };
    run();
    return () => { if (interval) clearInterval(interval as unknown as number); };
  }, [showPixModal, pixPaymentId, pixDeadline, id, group?.deposit_amount]);

  const formatCurrency = (n?: number | null) => (typeof n === "number" ? n.toFixed(2) : "0.00");
  const isValidUUID = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const isAbortError = (e: any) => !!e && (e.name === "AbortError" || (typeof e.message === "string" && e.message.toLowerCase().includes("aborted")));

  useEffect(() => {
    const controller = new AbortController();
    checkUser(controller.signal);
    return () => { controller.abort(); };
  }, [id]);

  const checkUser = async (signal?: AbortSignal) => {
    try {
      if (!isValidUUID(id)) {
        toast.error("ID do grupo inválido");
        navigate("/dashboard");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      await loadGroupData(signal);
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("id,is_admin")
        .abortSignal(signal as AbortSignal)
        .eq("id", session.user.id)
        .single();
      if (!meError && me) setIsAdmin(!!me.is_admin);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Error:", error);
      toast.error("Erro ao carregar dados do grupo");
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async (signal?: AbortSignal) => {
    if (!id || !isValidUUID(id)) return;
    try {
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .abortSignal(signal as AbortSignal)
        .eq("id", id)
        .single();
      if (groupError) throw groupError;
      setGroup(groupData);

      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select(`
          id,
          position,
          has_received,
          received_at,
          profile:profiles(full_name, cpf)
        `)
        .abortSignal(signal as AbortSignal)
        .eq("group_id", id)
        .order("position");
      if (membersError) throw membersError;
      setMembers(membersData || []);

      const { data: depositsData, error: depositsError } = await supabase
        .from("deposits")
        .select(`
          id,
          amount,
          status,
          created_at,
          member:group_members(profile:profiles(full_name))
        `)
        .abortSignal(signal as AbortSignal)
        .eq("group_id", id)
        .order("created_at", { ascending: false });
      if (depositsError) throw depositsError;
      setDeposits(depositsData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id,amount,status,due_date,paid_at,payer_id")
        .abortSignal(signal as AbortSignal)
        .eq("group_id", id)
        .order("week_number", { ascending: true });
      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);
    } catch (e: any) {
      if (isAbortError(e)) return;
      throw e;
    }
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

  const nextPosition = (() => {
    const pending = members.filter(m => !m.has_received).map(m => m.position).sort((a, b) => a - b);
    return pending.length ? pending[0] : null;
  })();

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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Membros do Grupo</CardTitle>
                    <CardDescription>
                      {members.length} de {group.max_members} membros
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Adicionar membro</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar membro ao grupo</DialogTitle>
                          <DialogDescription>Informe o CPF do usuário para adicionar.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Input placeholder="CPF" value={addCpf} onChange={e => setAddCpf(e.target.value)} />
                        </div>
                        <DialogFooter>
                          <Button disabled={adding} onClick={async () => {
                            try {
                              setAdding(true);
                              if (!id) return;
                              if (members.length >= (group.max_members || 5)) {
                                toast.error("Grupo já está cheio");
                                return;
                              }
                              const cleanCpf = addCpf.replace(/[^0-9]/g, "");
                              if (!cleanCpf) {
                                toast.error("Informe um CPF válido");
                                return;
                              }
                              const { data: profile, error: pErr } = await supabase
                                .from("profiles")
                                .select("id,full_name,cpf")
                                .eq("cpf", cleanCpf)
                                .single();
                              if (pErr || !profile) {
                                toast.error("Usuário não encontrado");
                                return;
                              }
                              // Avoid duplicates by checking existing membership
                              const { data: existing, error: existErr } = await supabase
                                .from("group_members")
                                .select("id")
                                .eq("group_id", id)
                                .eq("profile_id", profile.id)
                                .maybeSingle();
                              if (!existErr && existing) {
                                toast.error("Usuário já é membro do grupo");
                                return;
                              }
                              // Find first available position from 1..max_members
                              const used = new Set(members.map(m => m.position));
                              const max = group.max_members || 5;
                              let pos = 1;
                              while (pos <= max && used.has(pos)) pos++;
                              if (pos > max) {
                                toast.error("Não há posições disponíveis");
                                return;
                              }
                              const { error: insErr } = await supabase
                                .from("group_members")
                                .insert({ group_id: id, profile_id: profile.id, position: pos });
                              if (insErr) throw insErr;
                              toast.success("Membro adicionado");
                              setAddCpf("");
                              await loadGroupData();
                            } catch (e: any) {
                              toast.error(e.message || "Falha ao adicionar membro");
                            } finally {
                              setAdding(false);
                            }
                          }}>Adicionar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
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
                            {nextPosition != null && member.position === nextPosition && !member.has_received ? (
                              <span className="ml-2 text-xs font-semibold text-secondary">Pode solicitar</span>
                            ) : null}
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
                      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>Convidar membros</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Convidar membro por CPF</DialogTitle>
                            <DialogDescription>O convidado não pode já participar de outro grupo nem ser criador de um grupo.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <Input
                              placeholder="CPF"
                              value={inviteCpf}
                              onChange={async e => {
                                const v = e.target.value;
                                setInviteCpf(v);
                                const clean = v.replace(/[^0-9]/g, "");
                                if (clean.length === 11) {
                                  const { data: profile } = await supabase
                                    .from("profiles")
                                    .select("id,full_name,cpf")
                                    .eq("cpf", clean)
                                    .maybeSingle();
                                  if (profile) {
                                    setInviteProfileId(profile.id as string);
                                    setInviteProfileName(profile.full_name as string);
                                  } else {
                                    setInviteProfileId(null);
                                    setInviteProfileName(null);
                                  }
                                } else {
                                  setInviteProfileId(null);
                                  setInviteProfileName(null);
                                }
                              }}
                            />
                            {inviteCpf.replace(/[^0-9]/g, "").length === 11 && (
                              <p className="text-sm text-muted-foreground">
                                {inviteProfileName ? `Usuário: ${inviteProfileName}` : "Usuário não encontrado"}
                              </p>
                            )}
                          </div>
                          <DialogFooter>
                            <Button disabled={inviting} onClick={async () => {
                              try {
                                setInviting(true);
                                if (!id) return;
                                if (members.length >= (group.max_members || 5)) {
                                  toast.error("Grupo já está cheio");
                                  return;
                                }
                                const cleanCpf = inviteCpf.replace(/[^0-9]/g, "");
                                if (!cleanCpf) {
                                  toast.error("Informe um CPF válido");
                                  return;
                                }
                                let profileId = inviteProfileId;
                                if (!profileId) {
                                  const { data: profile, error: pErr } = await supabase
                                    .from("profiles")
                                    .select("id,full_name,cpf")
                                    .eq("cpf", cleanCpf)
                                    .single();
                                  if (pErr || !profile) {
                                    toast.error("Usuário não encontrado");
                                    return;
                                  }
                                  profileId = profile.id as string;
                                }
                                const { data: anyGroup } = await supabase
                                  .from("group_members")
                                  .select("group_id")
                                  .eq("profile_id", profileId)
                                  .limit(1);
                                if (Array.isArray(anyGroup) && anyGroup.length > 0) {
                                  toast.error("Usuário já participa de um grupo");
                                  return;
                                }
                                const { data: createdAny } = await supabase
                                  .from("groups")
                                  .select("id")
                                  .eq("created_by", profileId)
                                  .limit(1);
                                if (Array.isArray(createdAny) && createdAny.length > 0) {
                                  toast.error("Usuário já é criador de um grupo");
                                  return;
                                }
                                const used = new Set(members.map(m => m.position));
                                const max = group.max_members || 5;
                                let pos = 1;
                                while (pos <= max && used.has(pos)) pos++;
                                if (pos > max) {
                                  toast.error("Não há posições disponíveis");
                                  return;
                                }
                                const { error: insErr } = await supabase
                                  .from("group_members")
                                  .insert({ group_id: id, profile_id: profileId, position: pos });
                                if (insErr) {
                                  if (String(insErr.message || "").toLowerCase().includes("policy") || String(insErr.message || "").toLowerCase().includes("permission")) {
                                    toast.error("Apenas o criador do grupo pode convidar membros");
                                  } else {
                                    throw insErr;
                                  }
                                  return;
                                }
                                toast.success("Convite realizado e membro adicionado");
                                setInviteCpf("");
                                setInviteProfileId(null);
                                setInviteProfileName(null);
                                setInviteOpen(false);
                                await loadGroupData();
                              } catch (e: any) {
                                toast.error(e.message || "Falha ao convidar membro");
                              } finally {
                                setInviting(false);
                              }
                            }}>Convidar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
                              R$ {formatCurrency(deposit.amount)}
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
                            {formatDateBr(deposit.created_at)}
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
                  <span className="font-semibold">R$ {formatCurrency(group.deposit_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor recebido</span>
                  <span className="font-semibold text-secondary">
                    R$ {formatCurrency(group.payout_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pagamento semanal</span>
                  <span className="font-semibold">R$ {formatCurrency(group.weekly_payment)}</span>
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
                <Button className="w-full gap-2" onClick={async () => {
                  try {
                    setPixError(null);
                    setPixQrBase64(null);
                    setPixQrCode(null);
                    setPixLoading(true);
                    setShowPixModal(true);
                    const amount = group.deposit_amount;
                    const { data, error } = await supabase.functions.invoke("pix_deposit", {
                      body: { amount, description: `Depósito inicial • Grupo ${group.name}` }
                    });
                    if (error) throw error;
                    setPixQrBase64((data as any)?.qr_code_base64 || null);
                    setPixQrCode((data as any)?.qr_code || null);
                    setPixPaymentId((data as any)?.id || null);
                    setPixDeadline(Date.now() + 5 * 60 * 1000);
                  } catch (e: any) {
                    setPixError(e.message || "Falha ao gerar QR Code Pix");
                    toast.error(e.message || "Falha ao gerar QR Code Pix");
                  } finally {
                    setPixLoading(false);
                  }
                }}>
                  <QrCode className="h-4 w-4" />
                  Fazer depósito via Pix
                </Button>
                <Button variant="outline" className="w-full">
                  Ver meus pagamentos
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={requesting}
                  onClick={async () => {
                    try {
                      setRequesting(true);
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) {
                        navigate("/auth");
                        return;
                      }
                      const { data: member } = await supabase
                        .from("group_members")
                        .select("id,position,has_received")
                        .eq("group_id", id)
                        .eq("profile_id", session.user.id)
                        .maybeSingle();
                      if (!member) {
                        setRequestErrorMsg("Você não é membro deste grupo");
                        setRequestErrorOpen(true);
                        return;
                      }
                      if (member.has_received) {
                        setRequestErrorMsg("Você já recebeu neste ciclo");
                        setRequestErrorOpen(true);
                        return;
                      }
                      if (nextPosition == null || member.position !== nextPosition) {
                        setRequestErrorMsg("Aguarde sua vez");
                        setRequestErrorOpen(true);
                        return;
                      }
                      if (members.length < (group.max_members || 0)) {
                        setRequestErrorMsg("Não há membros suficientes para a operação");
                        setRequestErrorOpen(true);
                        return;
                      }
                      const { data: existing } = await supabase
                        .from("loan_requests")
                        .select("id,status")
                        .eq("user_id", session.user.id)
                        .eq("group_id", id)
                        .eq("status", "pending")
                        .maybeSingle();
                      if (existing) {
                        setRequestErrorMsg("Já existe uma solicitação em andamento");
                        setRequestErrorOpen(true);
                        return;
                      }
                      const { data: prof } = await supabase
                        .from("profiles")
                        .select("full_name,cpf")
                        .eq("id", session.user.id)
                        .maybeSingle();
                      const amount = group.payout_amount;
                      const payload: any = {
                        user_id: session.user.id,
                        full_name: prof?.full_name || null,
                        cpf: prof?.cpf || null,
                        group_id: id,
                        amount,
                        status: "pending",
                      };
                      const { error: reqErr } = await supabase
                        .from("loan_requests")
                        .insert(payload);
                      if (reqErr) throw reqErr;
                      toast.success("Solicitação de empréstimo enviada");
                    } catch (e: any) {
                      toast.error(e.message || "Falha ao solicitar empréstimo");
                    } finally {
                      setRequesting(false);
                    }
                  }}
                >
                  Solicitar empréstimo
                </Button>
              </CardContent>
            </Card>

            <Dialog open={requestErrorOpen} onOpenChange={setRequestErrorOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Não é sua vez</DialogTitle>
                  <DialogDescription>{requestErrorMsg || "Aguarde sua vez"}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setRequestErrorOpen(false)}>Entendi</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                  {deposits.filter(d => d.status === "confirmed").length}/{members.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagamentos pendentes/atrasados</span>
                <span className="font-semibold">
                  {payments.filter(p => p.status === "pending" || p.status === "late").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo a receber</span>
                <span className="font-semibold">
                  R$ {formatCurrency(payments.filter(p => p.status === "pending" || p.status === "late").reduce((acc, p) => acc + (p.amount || 0), 0))}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parcelas por membro</CardTitle>
              <CardDescription>Quantas parcelas faltam para cada membro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum membro</p>
              ) : (
                <div className="space-y-2">
                  {members.filter(m => m.has_received).length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-3">Nenhum membro com parcelas ativas</p>
                  ) : members.filter(m => m.has_received).map(m => {
                    const expected = 4;
                    const paidCount = payments.filter(p => p.payer_id === m.id && p.status === "paid").length;
                    const remaining = Math.max(expected - paidCount, 0);
                    return (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium text-foreground">{m.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Posição {m.position}
                            {m.position === group.current_cycle && !m.has_received ? (
                              <span className="ml-2 text-[10px] font-semibold text-secondary">Pode solicitar</span>
                            ) : null}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={remaining === 0 ? "secondary" : "outline"}>
                            {remaining === 0 ? "Concluído" : `Faltam ${remaining} de ${expected}`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </main>

      {/* Pix Modal */}
      {showPixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Pagamento via Pix</CardTitle>
              <CardDescription>Gerado via Mercado Pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
                {pixLoading ? (
                  <div className="h-48 w-48 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : pixQrBase64 ? (
                  <img src={`data:image/png;base64,${pixQrBase64}`} alt="QR Code Pix" className="h-48 w-48 rounded" />
                ) : (
                  <div className="h-48 w-48 bg-background rounded-lg flex items-center justify-center">
                    <QrCode className="h-32 w-32 text-muted-foreground" />
                  </div>
                )}
                {pixQrCode ? (
                  <p className="mt-3 text-xs break-all text-muted-foreground text-center">{pixQrCode}</p>
                ) : null}
                {pixError ? (
                  <p className="mt-3 text-xs text-destructive">{pixError}</p>
                ) : null}
                {pixDeadline ? (
                  <p className="mt-2 text-xs text-muted-foreground">Tempo restante: {Math.max(Math.floor(((pixDeadline - pixNow) / 1000)), 0)}s</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${pixQrBase64 ? "bg-secondary" : "bg-muted-foreground"}`} />
                  <span>QR gerado</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${pixPaymentId ? "bg-secondary" : "bg-muted-foreground"}`} />
                  <span>Aguardando pagamento</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${(!showPixModal && pixPaymentId) ? "bg-secondary" : "bg-muted-foreground"}`} />
                  <span>Confirmado</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Valor: R$ {formatCurrency(group.deposit_amount)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPixModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={!pixQrCode} onClick={() => navigator.clipboard.writeText(pixQrCode || "").then(() => toast.success("Chave Pix copiada"))}>
                  Copiar chave Pix
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