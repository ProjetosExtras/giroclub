import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");

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
      const cpfNumbers = cpf.replace(/\D/g, "");
      
      if (cpfNumbers.length !== 11) {
        throw new Error("CPF deve ter 11 dígitos");
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
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
      toast.success("Conta criada com sucesso! Você já pode fazer login.");
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
          <Tabs defaultValue="signin" className="w-full">
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