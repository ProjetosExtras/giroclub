import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [tab, setTab] = useState("signin");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return cpf;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let emailToUse = email;
      const cleanCpf = cpf.replace(/\D/g, "");

      if (!emailToUse && cleanCpf) {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("email")
          .eq("cpf", cleanCpf)
          .maybeSingle();
        if (pErr) throw pErr;
        if (!profile || !profile.email) {
          throw new Error("CPF não encontrado ou sem email associado");
        }
        emailToUse = profile.email as string;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) throw error;
      toast.success("Login realizado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (password !== confirmPassword) {
        throw new Error("As senhas não coincidem");
      }

      if (!acceptedTerms) {
        throw new Error("É necessário aceitar os Termos de Uso");
      }

      const cpfNumbers = cpf.replace(/\D/g, "");
      
      if (cpfNumbers.length !== 11) {
        throw new Error("CPF deve ter 11 dígitos");
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            cpf: cpfNumbers,
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      const user = signUpData?.user;
      if (user) {
        const { data: profExists } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .limit(1);
        const exists = Array.isArray(profExists) && profExists.length > 0;
        if (!exists) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              full_name: fullName,
              cpf: cpfNumbers,
            });
          if (profileError) throw profileError;
        }

        // Auto-assign to an available group with vacancies
        try {
          const { data: groups, error: gErr } = await supabase
            .from("groups")
            .select("id,max_members,created_at,status")
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(10);
          if (!gErr && groups && groups.length > 0) {
            let picked: { id: string; max_members: number } | null = null;
            for (const g of groups) {
              const { data: gm } = await supabase
                .from("group_members")
                .select("position")
                .eq("group_id", g.id);
              const used = new Set((gm || []).map(m => m.position as number));
              const max = (g.max_members as number) || 5;
              if (used.size < max) {
                picked = { id: g.id, max_members: max };
                // find first free position
                let pos = 1;
                while (pos <= max && used.has(pos)) pos++;
                if (pos <= max) {
                  const { data: already } = await supabase
                    .from("group_members")
                    .select("id")
                    .eq("group_id", g.id)
                    .eq("profile_id", user.id)
                    .maybeSingle();
                  if (!already) {
                    const { error: joinErr } = await supabase
                      .from("group_members")
                      .insert({ group_id: g.id, profile_id: user.id, position: pos });
                    if (!joinErr) {
                      toast.success("Você foi adicionado a um grupo disponível");
                    }
                  }
                }
                break;
              }
            }
          }
        } catch {}
      }
      try {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!loginErr) {
          toast.success("Conta criada e login realizado!");
          navigate("/dashboard");
        } else {
          toast.success("Conta criada com sucesso! Você já pode fazer login.");
          setTab("signin");
        }
      } catch {
        toast.success("Conta criada com sucesso! Você já pode fazer login.");
        setTab("signin");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">GiroClub</CardTitle>
          <CardDescription>
            Acesse sua conta ou crie uma nova
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signin">Email (ou deixe em branco para usar CPF)</Label>
                  <Input
                    id="email-signin"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf-signin">CPF (opcional)</Label>
                  <Input
                    id="cpf-signin"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCPFChange}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signin">Senha</Label>
                  <Input
                    id="password-signin"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Nome completo</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="João da Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCPFChange}
                    maxLength={14}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Senha</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm">Confirmar senha</Label>
                  <Input
                    id="password-confirm"
                    type="password"
                    placeholder="Repita sua senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(!!v)} />
                  <div className="space-y-1">
                    <Label htmlFor="terms">Aceito os Termos de Uso</Label>
                    <p className="text-xs text-muted-foreground">
                      O projeto é um clube de crédito rotativo. Não há garantia de retorno ou lucros; a plataforma apenas intermedia a gestão entre pessoas físicas.
                      Valores e compromissos são de responsabilidade dos membros do grupo.
                    </p>
                    <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="link" className="px-0">Ler Termos de Uso</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Termos de Uso • GiroClub</DialogTitle>
                          <DialogDescription>
                            🏦 Legalidade
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                          <p>
                            O dono da plataforma não empresta dinheiro. A plataforma apenas intermedia a gestão entre pessoas físicas, como um clube de crédito rotativo.
                          </p>
                          <p>
                            O projeto não garante retorno nem lucros. O serviço limita-se à gestão e controle de grupos.
                          </p>
                          <p>
                            Os valores, aportes e responsabilidades são exclusivos dos membros de cada grupo. A plataforma não se responsabiliza por inadimplências ou acordos privados.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;