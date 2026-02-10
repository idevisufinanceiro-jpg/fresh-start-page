import { LayoutDashboard, Users, FileText, Briefcase, Calendar, DollarSign, BarChart3, Settings, LogOut, User, ShoppingBag, Shield, RefreshCcw, Bell, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
const menuItems = [{
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard
}, {
  title: "Clientes",
  url: "/customers",
  icon: Users
}, {
  title: "Orçamentos",
  url: "/quotes",
  icon: FileText
}, {
  title: "Vendas",
  url: "/sales",
  icon: ShoppingBag
}, {
  title: "Assinaturas",
  url: "/subscriptions",
  icon: RefreshCcw
}, {
  title: "Serviços",
  url: "/services",
  icon: Briefcase
}, {
  title: "Agenda",
  url: "/calendar",
  icon: Calendar
}, {
  title: "Financeiro",
  url: "/financial",
  icon: DollarSign
}, {
  title: "Relatórios",
  url: "/reports",
  icon: BarChart3
}, {
  title: "Tarefas",
  url: "/tasks",
  icon: ClipboardList
}, {
  title: "Notificações",
  url: "/notifications",
  icon: Bell
}, {
  title: "Configurações",
  url: "/settings",
  icon: Settings
}];

const adminMenuItems = [{
  title: "Usuários",
  url: "/users",
  icon: Shield
}];
export function AppSidebar() {
  const {
    signOut,
    user
  } = useAuth();
  const navigate = useNavigate();

  // Fetch company settings for logo - shared for all users
  const {
    data: companySettings
  } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("logo_url, company_name")
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role-sidebar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return data?.role;
    },
    enabled: !!user
  });

  const isAdmin = userRole === "admin";

  // Fetch profile for avatar
  const {
    data: profile
  } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("profiles").select("avatar_url, full_name").eq("user_id", user?.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  return <Sidebar className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            {companySettings?.logo_url ? <img src={companySettings.logo_url} alt="Logo" className="h-11 max-w-[120px] rounded-xl object-contain" /> : <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>}
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">
                {companySettings?.company_name || "Idevisu Gestão"}
              </h2>
              <p className="text-xs text-primary font-medium">Gestão Criativa</p>
            </div>
          </div>
        </div>
        
        <SidebarGroup className="px-3 py-4">
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-3 px-3 font-semibold">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200" activeClassName="bg-primary text-primary-foreground font-semibold shadow-md">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
              {isAdmin && adminMenuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200" activeClassName="bg-primary text-primary-foreground font-semibold shadow-md">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/30" /> : <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {profile?.full_name || user?.user_metadata?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60 hover:text-primary hover:bg-primary/10" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>;
}