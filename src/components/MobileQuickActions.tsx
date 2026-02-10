import { FileText, ShoppingBag, Users, Briefcase, CheckSquare, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickAction {
  title: string;
  icon: typeof FileText;
  url: string;
  color: string;
  bgColor: string;
}

const quickActions: QuickAction[] = [
  { 
    title: "Orçamentos", 
    icon: FileText, 
    url: "/quotes",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30"
  },
  { 
    title: "Vendas", 
    icon: ShoppingBag, 
    url: "/sales",
    color: "text-primary",
    bgColor: "bg-primary/10"
  },
  { 
    title: "Clientes", 
    icon: Users, 
    url: "/customers",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
  },
  { 
    title: "Serviços", 
    icon: Briefcase, 
    url: "/services",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
  { 
    title: "Tarefas", 
    icon: CheckSquare, 
    url: "/tasks",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30"
  },
  { 
    title: "Agenda", 
    icon: Calendar, 
    url: "/calendar",
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30"
  },
];

export function MobileQuickActions() {
  const navigate = useNavigate();

  return (
    <div className="md:hidden px-4 -mt-4 relative z-10 overflow-x-hidden w-full max-w-full">
      <div className="bg-card rounded-2xl shadow-elevated p-4 overflow-hidden">
        <div className="grid grid-cols-3 gap-2 overflow-hidden">
          {quickActions.map((action) => (
            <button
              key={action.url}
              onClick={() => navigate(action.url)}
              className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-muted/50 transition-all active:scale-95"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                action.bgColor
              )}>
                <action.icon className={cn("h-5 w-5", action.color)} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                {action.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
