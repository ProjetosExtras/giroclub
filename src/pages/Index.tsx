import { Button } from "@/components/ui/button";
import { ArrowRight, Users, TrendingUp, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="container relative mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              Empréstimos em grupo simplificados
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Bem-vindo ao{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                GiroClub
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              Uma forma inteligente e colaborativa de ter acesso a crédito.
              Forme grupos de 5 pessoas e receba R$ 300 quando for sua vez.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Começar agora <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#como-funciona">Como funciona</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Por que escolher o GiroClub?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Sistema de crédito rotativo que beneficia todos os membros do grupo
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                Grupos de 5 pessoas
              </h3>
              <p className="text-muted-foreground">
                Forme ou participe de grupos com 4 amigos. Cada um deposita R$ 100 para começar.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                Receba R$ 300
              </h3>
              <p className="text-muted-foreground">
                Quando for sua vez, receba R$ 300 e pague R$ 80 por semana durante 4 semanas.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                Seguro e transparente
              </h3>
              <p className="text-muted-foreground">
                Acompanhe todos os pagamentos em tempo real. Sistema 100% transparente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Como funciona?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Sistema simples e colaborativo em 4 passos
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                1
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Forme um grupo
                </h3>
                <p className="text-muted-foreground">
                  Convide 4 amigos para formar um grupo de 5 pessoas.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                2
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Deposite R$ 100
                </h3>
                <p className="text-muted-foreground">
                  Cada membro deposita R$ 100 para iniciar o ciclo do grupo.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                3
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Receba sua vez
                </h3>
                <p className="text-muted-foreground">
                  A cada semana, um membro recebe R$ 300 do grupo.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                4
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Pague semanalmente
                </h3>
                <p className="text-muted-foreground">
                  Após receber, pague R$ 80 por semana durante 4 semanas.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="mx-auto inline-block rounded-xl border bg-card p-6">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Taxa de serviço
              </p>
              <p className="text-3xl font-bold text-foreground">5%</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Sobre cada transação para manter a plataforma
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Crie sua conta e forme seu primeiro grupo hoje mesmo
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/auth">
              Criar conta grátis <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 GiroClub. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;