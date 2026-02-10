import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, DollarSign, AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { ListSkeleton } from "@/components/ui/page-skeleton";

interface Notification {
  id: string;
  type: "event" | "payment" | "service";
  title: string;
  message: string;
  date: Date;
  daysUntil: number;
  isOverdue: boolean;
  entityId: string;
  saleId?: string | null;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 8);

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events-notifications-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, sale_id")
        .gte("start_time", today.toISOString())
        .lte("start_time", sevenDaysFromNow.toISOString())
        .order("start_time", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 120000,
    placeholderData: [],
  });

  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["pending-payments-notifications-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount, due_date, sale_id, customers(name)")
        .eq("type", "income")
        .neq("payment_status", "paid")
        .not("due_date", "is", null)
        .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 120000,
    placeholderData: [],
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["services-notifications-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, title, due_date, customers(name)")
        .neq("status", "completed")
        .not("due_date", "is", null)
        .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 120000,
    placeholderData: [],
  });

  const isInitialLoading = eventsLoading && paymentsLoading && servicesLoading && 
    events.length === 0 && pendingPayments.length === 0 && services.length === 0;

  const notifications: Notification[] = [];

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
        entityId: event.id,
        saleId: event.sale_id,
      });
    }
  });

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
        entityId: payment.id,
        saleId: payment.sale_id,
      });
    }
  });

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
        entityId: service.id,
      });
    }
  });

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  visibleNotifications.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.daysUntil - b.daysUntil;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "event": return <Calendar className="h-5 w-5 text-primary" />;
      case "payment": return <DollarSign className="h-5 w-5 text-warning" />;
      case "service": return <AlertTriangle className="h-5 w-5 text-info" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    switch (notification.type) {
      case "event": navigate(`/calendar?date=${format(notification.date, "yyyy-MM-dd")}`); break;
      case "payment": notification.saleId ? navigate(`/sales?view=${notification.saleId}`) : navigate("/financial"); break;
      case "service": navigate(`/services?view=${notification.entityId}`); break;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "event": return "Evento";
      case "payment": return "Pagamento";
      case "service": return "Serviço";
      default: return "";
    }
  };

  const handleClearAll = () => setDismissedIds(notifications.map(n => n.id));
  const handleDismiss = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setDismissedIds(prev => [...prev, id]); };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold truncate">Notificações</h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-base truncate">Acompanhe seus eventos e entregas</p>
          </div>
        </div>
        {visibleNotifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-2 flex-shrink-0">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Limpar tudo</span>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Bell className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{visibleNotifications.length} {visibleNotifications.length === 1 ? "notificação" : "notificações"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isInitialLoading ? (
            <div className="p-4"><ListSkeleton items={5} /></div>
          ) : visibleNotifications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tudo em dia!</h3>
              <p className="text-muted-foreground text-sm">Não há notificações pendentes no momento.</p>
            </div>
          ) : (
            <div className="divide-y max-h-[55vh] overflow-y-auto overflow-x-hidden">
              {visibleNotifications.map((notification) => (
                <div key={notification.id} onClick={() => handleNotificationClick(notification)} className={`p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors ${notification.isOverdue ? "bg-destructive/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] md:text-xs">{getTypeLabel(notification.type)}</Badge>
                        {notification.isOverdue && <Badge variant="destructive" className="text-[10px] md:text-xs">Atrasado</Badge>}
                      </div>
                      <p className="font-medium text-sm md:text-base truncate">{notification.title}</p>
                      <p className={`text-xs md:text-sm truncate ${notification.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{notification.message}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">{format(notification.date, "EEE, dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDismiss(notification.id, e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
