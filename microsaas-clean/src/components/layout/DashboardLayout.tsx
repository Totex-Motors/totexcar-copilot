import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser, useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/pages/Auth";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { PaywallScreen } from "@/components/trial/PaywallScreen";
import { useTrialControl } from "@/hooks/useTrialControl";
import { useNavigate, Navigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, userData, loading } = useCurrentUser();
  const { signOut } = useAuth();
  const { trialInfo, loading: trialLoading } = useTrialControl();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const goToSettings = () => navigate(userData?.role === "admin" ? "/admin" : "/settings");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Lojista nunca usa as telas de proprietário/admin — vai sempre para o painel dele
  if (userData?.role === "dealer") {
    return <Navigate to="/lojista" replace />;
  }

  // Bloqueio total: trial expirou e não assinou (ou assinatura vencida/cancelada).
  // Só vale para o dono; admin/lojista não bloqueiam (tratado no useTrialControl).
  if (!trialLoading && trialInfo.isBlocked) {
    return <PaywallScreen userName={userData?.name} onLogout={handleLogout} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <SidebarTrigger className="text-foreground flex-shrink-0" />
                <div className="relative w-full max-w-sm hidden md:block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar gastos, categorias..."
                    className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-primary-foreground font-bold">3</span>
                  </span>
                </Button>
                
                <Button variant="ghost" size="icon" onClick={goToSettings} title="Configurações">
                  <Settings className="h-5 w-5" />
                </Button>
                
                <div className="h-6 w-px bg-border" />
                
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-primary text-white font-semibold">
                      {userData?.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium">{userData?.name || 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground">{userData?.plan || 'Gratuito'}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 p-6 space-y-6">
            <TrialBanner />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}