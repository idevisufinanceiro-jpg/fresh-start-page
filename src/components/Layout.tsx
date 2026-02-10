import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileNavigation } from "@/components/MobileNavigation";
import { MobileQuickActions } from "@/components/MobileQuickActions";
import { Bell, Calendar, DollarSign, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  id: string;
  type: "event" | "payment" | "service";
  title: string;
  message: string;
  date: Date;
  daysUntil: number;
  isOverdue: boolean;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const today = startOfDay(new Date());
  const isDashboard = location.pathname === "/";

  // Fetch calendar events
  const { data: events } = useQuery({
    queryKey: ["calendar-events-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", today.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch pending financial entries (payments)
  const { data: pendingPayments } = useQuery({
    queryKey: ["pending-payments-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, customers(name)")
        .eq("type", "income")
        .neq("payment_status", "paid")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch services with due dates
  const { data: services } = useQuery({
    queryKey: ["services-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, customers(name)")
        .neq("status", "completed")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Build notifications list
  const notifications: Notification[] = [];

  // Add calendar events (next 7 days)
  events?.forEach((event) => {
    const eventDate = new Date(event.start_time);
    const daysUntil = differenceInDays(startOfDay(eventDate), today);
    
    if (daysUntil <= 7 && daysUntil >= 0) {
      let message = "";
      if (daysUntil === 0) message = "Hoje!";
      else if (daysUntil === 1) message = "Amanhã";
      else message = `Faltam ${daysUntil} dias`;

      notifications.push({
        id: `event-${event.id}`,
        type: "event",
        title: event.title,
        message,
        date: eventDate,
        daysUntil,
        isOverdue: false,
      });
    }
  });

  // Add pending payments
  pendingPayments?.forEach((payment) => {
    if (!payment.due_date) return;
    const dueDate = new Date(payment.due_date);
    const daysUntil = differenceInDays(startOfDay(dueDate), today);
    const isOverdue = isBefore(dueDate, today);

    if (daysUntil <= 7 || isOverdue) {
      let message = "";
      if (isOverdue) message = `Vencido há ${Math.abs(daysUntil)} dias`;
      else if (daysUntil === 0) message = "Vence hoje!";
      else if (daysUntil === 1) message = "Vence amanhã";
      else message = `Vence em ${daysUntil} dias`;

      notifications.push({
        id: `payment-${payment.id}`,
        type: "payment",
        title: payment.description,
        message: `${message} - R$ ${Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        date: dueDate,
        daysUntil,
        isOverdue,
      });
    }
  });

  // Add services with due dates
  services?.forEach((service) => {
    if (!service.due_date) return;
    const dueDate = new Date(service.due_date);
    const daysUntil = differenceInDays(startOfDay(dueDate), today);
    const isOverdue = isBefore(dueDate, today);

    if (daysUntil <= 7 || isOverdue) {
      let message = "";
      if (isOverdue) message = `Atrasado há ${Math.abs(daysUntil)} dias`;
      else if (daysUntil === 0) message = "Entrega hoje!";
      else if (daysUntil === 1) message = "Entrega amanhã";
      else message = `Entrega em ${daysUntil} dias`;

      notifications.push({
        id: `service-${service.id}`,
        type: "service",
        title: service.title,
        message,
        date: dueDate,
        daysUntil,
        isOverdue,
      });
    }
  });

  // Sort notifications: overdue first, then by date
  notifications.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.daysUntil - b.daysUntil;
  });

  const hasNotifications = notifications.length > 0;
  const hasOverdue = notifications.some((n) => n.isOverdue);

  const getIcon = (type: string) => {
    switch (type) {
      case "event":
        return <Calendar className="h-4 w-4 text-primary" />;
      case "payment":
        return <DollarSign className="h-4 w-4 text-amber-500" />;
      case "service":
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const NotificationsContent = () => (
    <div className="w-full overflow-hidden">
      <div className="flex items-center justify-between p-3 md:p-4 border-b gap-2">
        <h3 className="font-semibold text-sm md:text-base truncate">Notificações</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            variant="link" 
            size="sm" 
            className="text-xs text-primary p-0 h-auto whitespace-nowrap"
            onClick={() => {
              setIsOpen(false);
              window.location.href = "/notifications";
            }}
          >
            Ver todas
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[250px] md:h-[300px]">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 hover:bg-muted/50 ${notification.isOverdue ? "bg-destructive/5" : ""}`}
              >
                <div className="flex gap-2 items-start overflow-hidden">
                  <div className="mt-0.5 flex-shrink-0">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    <p className={`text-xs truncate ${notification.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(notification.date, "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24 overflow-x-hidden w-full max-w-full box-border">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <MobileHeader
            hasNotifications={hasNotifications}
            hasOverdue={hasOverdue}
            onNotificationClick={() => setIsOpen(true)}
          />
          <PopoverTrigger className="hidden" />
          <PopoverContent className="w-[calc(100vw-2rem)] max-w-80 p-0 mx-4" align="end">
            <NotificationsContent />
          </PopoverContent>
        </Popover>
        
        {isDashboard && <MobileQuickActions />}
        
        <main className="px-4 py-4 overflow-x-hidden w-full max-w-full box-border">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
        
        <MobileNavigation />
      </div>
    );
  }

  // Desktop Layout
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen w-full overflow-hidden">
          <header className="h-14 md:h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-3 md:px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-2 md:mr-4" />
            
            <div className="flex items-center gap-2">
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
                    <Bell className={`h-4 w-4 md:h-5 md:w-5 ${hasOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                    {hasNotifications && (
                      <span className={`absolute top-1 right-1 md:top-1.5 md:right-1.5 w-2 h-2 rounded-full ${hasOverdue ? "bg-destructive" : "bg-primary"}`} />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] max-w-80 p-0" align="end">
                  <NotificationsContent />
                </PopoverContent>
              </Popover>
            </div>
          </header>
          
          <main className="flex-1 p-3 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
