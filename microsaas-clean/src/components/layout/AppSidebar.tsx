import {
  BarChart3,
  Receipt,
  Home,
  Car,
  FileText,
  Tag,
  ShieldCheck,
  Gift,
  Banknote,
  Wrench,
  Landmark,
  Navigation,
  Cpu,
  ShieldAlert,
  LifeBuoy,
  Warehouse,
  LogOut
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/hooks/useAuth";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigation = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Gastos", url: "/transactions", icon: Receipt },
  { title: "Análises", url: "/analytics", icon: BarChart3 },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Categorias", url: "/categories", icon: Tag },
  { title: "Meu Veículo", url: "/settings", icon: Car },
  { title: "Garagem Totex", url: "/garagem", icon: Warehouse },
  { title: "Rastreador", url: "/rastreador", icon: Navigation },
  { title: "Carro Conectado", url: "/conectado", icon: Cpu },
  { title: "Manutenção", url: "/manutencao", icon: Wrench },
  { title: "Multas", url: "/multas", icon: ShieldAlert },
  { title: "Financiamento", url: "/financiamento", icon: Landmark },
  { title: "Indique e Ganhe", url: "/indique", icon: Gift },
  { title: "Vender meu carro", url: "/recompra", icon: Banknote },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { userData } = useCurrentUser();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = userData?.role === "admin"
    ? [...navigation, { title: "Admin", url: "/admin", icon: ShieldCheck }]
    : navigation;

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true;
    if (path !== "/" && currentPath.startsWith(path)) return true;
    return false;
  };

  const getNavClasses = (path: string) => {
    const active = isActive(path);
    return active 
      ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium border-r-2 border-sidebar-primary" 
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";
  };

  return (
    <Sidebar className={`${collapsed ? "w-16" : "w-64"} border-r border-sidebar-border transition-all duration-300`}>
      <SidebarContent className="bg-sidebar">
        {/* Header */}
        <div className="px-4 pt-6 pb-5">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/totexmotors-logo.png"
              alt="Totexmotors"
              className={`${collapsed ? "h-7" : "w-44 max-w-full"} object-contain drop-shadow`}
            />
            {!collapsed && (
              <h1 className="text-base font-extrabold tracking-wide text-center text-white">
                TotexCar Co-pilot
              </h1>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="px-3 pt-6">
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium mb-3">
            {!collapsed ? "NAVEGAÇÃO" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${getNavClasses(item.url)}`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}