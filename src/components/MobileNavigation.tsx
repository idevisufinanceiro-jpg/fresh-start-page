import { LayoutDashboard, Users, FileText, ShoppingBag, Calendar, DollarSign, Briefcase, Settings, BarChart3 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Vendas", url: "/sales", icon: ShoppingBag },
  { title: "Agenda", url: "/calendar", icon: Calendar },
  { title: "Financeiro", url: "/financial", icon: DollarSign },
  { title: "Config", url: "/settings", icon: Settings },
];

export function MobileNavigation() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom overflow-x-hidden">
      <div className="flex items-center justify-around py-2 px-1 max-w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url || 
            (item.url !== "/" && location.pathname.startsWith(item.url));
          
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-full transition-all duration-200",
                isActive && "bg-primary text-primary-foreground shadow-md"
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
