import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewGroup from "./pages/NewGroup";
import GroupDetails from "./pages/GroupDetails";
import AdminUsers from "./pages/AdminUsers";
import AdminRequests from "./pages/AdminRequests";
import AdminGroups from "./pages/AdminGroups";
import AdminDashboard from "./pages/AdminDashboard";
import AdminFinance from "./pages/AdminFinance";
import NotFound from "./pages/NotFound";
import { Component, ReactNode } from "react";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: any }>{
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any) {
    console.error("Unhandled error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Algo deu errado</h2>
            <p className="text-muted-foreground mb-4">Tente recarregar a página ou voltar ao início.</p>
            <a href="/" className="underline">Ir para início</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/admin/groups" element={<AdminGroups />} />
            <Route path="/groups/new" element={<NewGroup />} />
            <Route path="/groups/:id" element={<GroupDetails />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
