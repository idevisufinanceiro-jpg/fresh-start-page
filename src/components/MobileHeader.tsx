import { Bell, Menu, X, User, ChevronRight, Users, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, ShoppingBag, Calendar, DollarSign, Briefcase, Settings, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

const allMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/customers", icon: User },
  { title: "Orçamentos", url: "/quotes", icon: FileText },
  { title: "Vendas", url: "/sales", icon: ShoppingBag },
  { title: "Assinaturas", url: "/subscriptions", icon: RefreshCcw },
  { title: "Serviços", url: "/services", icon: Briefcase },
  { title: "Agenda", url: "/calendar", icon: Calendar },
  { title: "Financeiro", url: "/financial", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Notificações", url: "/notifications", icon: Bell },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const adminMenuItems = [
  { title: "Usuários", url: "/users", icon: Users },
];

interface MobileHeaderProps {
  hasNotifications?: boolean;
  hasOverdue?: boolean;
  onNotificationClick?: () => void;
}

export function MobileHeader({ hasNotifications, hasOverdue, onNotificationClick }: MobileHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch shared company settings (first one)
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("logo_url, company_name"),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return data?.role;
    },
    enabled: !!user,
  });

  const isAdmin = userRole === "admin";

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const menuItems = isAdmin ? [...allMenuItems, ...adminMenuItems] : allMenuItems;

  return (
    <header className="md:hidden relative">
      {/* Curved Header Background */}
      <div className="bg-gradient-to-br from-primary to-primary/80 pb-8 pt-4 px-4 rounded-b-[32px]">
        <div className="flex items-center justify-between mb-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-card flex flex-col h-full" aria-describedby={undefined}>
              <VisuallyHidden.Root>
                <SheetTitle>Menu de navegação</SheetTitle>
              </VisuallyHidden.Root>
              <div className="p-6 bg-gradient-to-br from-primary to-primary/80">
                <div className="flex items-center gap-3">
                  {companySettings?.logo_url ? (
                    <img
                      src={companySettings.logo_url}
                      alt="Logo"
                      className="h-12 max-w-[120px] rounded-xl object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {companySettings?.company_name || "Idevisu Gestão"}
                    </h2>
                    <p className="text-xs text-white/70">Gestão Criativa</p>
                  </div>
                </div>
              </div>

              {/* Menu scrolla e respeita o rodapé (não fica por trás da conta) */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1 pb-32">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-muted"
                      )
                    }
                    end={item.url === "/"}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                    <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto p-4 border-t border-border bg-card">
                <div className="flex items-center gap-3 mb-3">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {profile?.full_name || "Usuário"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-primary-foreground hover:bg-white/10"
            onClick={onNotificationClick}
          >
            <Bell className={`h-5 w-5 ${hasOverdue ? "text-yellow-300" : ""}`} />
            {hasNotifications && (
              <span
                className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-primary ${
                  hasOverdue ? "bg-yellow-400" : "bg-white"
                }`}
              />
            )}
          </Button>
        </div>

        {/* Greeting */}
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <p className="text-white/80 text-sm">{greeting()},</p>
            <h1 className="text-white text-xl font-bold">
              {profile?.full_name?.split(" ")[0] || "Usuário"}!
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}
