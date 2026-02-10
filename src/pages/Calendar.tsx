import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarView, type CalendarView as ViewType } from "@/components/calendar/CalendarView";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileTabSelect, type TabOption } from "@/components/ui/mobile-tab-select";
import { format, isBefore, startOfDay, isSameDay, startOfMonth, endOfMonth, isAfter, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Package, 
  CheckCircle2, 
  Search, 
  Filter,
  Clock,
  AlertTriangle,
  Check,
  X,
  CalendarDays,
  PartyPopper,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;
type Sale = Tables<"sales">;

export default function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("calendar");

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .not("due_date", "is", null)
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });

  // Sales with delivery dates or event dates
  const { data: sales = [] } = useQuery({
    queryKey: ["sales-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name)")
        .or("delivery_date.not.is.null,event_date.not.is.null")
        .order("delivery_date");
      if (error) throw error;
      return data as (Sale & { customers: { name: string } | null })[];
    },
  });

  // Filtrar eventos do calendário para remover vendas concluídas
  const filteredEvents = useMemo(() => {
    // IDs das vendas que foram marcadas como entregues/concluídas
    const deliveredSaleIds = sales.filter(s => s.payment_status === "delivered").map(s => s.id);
    
    // Filtrar eventos: remover os que pertencem a vendas concluídas
    return events.filter(event => {
      if (event.sale_id && deliveredSaleIds.includes(event.sale_id)) {
        return false;
      }
      return true;
    });
  }, [events, sales]);

  const today = startOfDay(new Date());

  // Pedidos para entregar (vendas com data de entrega que NÃO são eventos)
  const pendingDeliveries = useMemo(() => {
    return sales
      .filter(sale => {
        if (!sale.delivery_date) return false;
        // Mostrar apenas vendas que NÃO são eventos
        if (sale.is_event) return false;
        // Mostrar apenas vendas que ainda não foram marcadas como entregues
        return sale.payment_status !== "delivered";
      })
      .filter(sale => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          sale.title.toLowerCase().includes(term) ||
          sale.sale_number.toLowerCase().includes(term) ||
          sale.customers?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.delivery_date!);
        const dateB = new Date(b.delivery_date!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [sales, searchTerm]);

  // Eventos concluídos (eventos passados)
  const completedEvents = useMemo(() => {
    return events
      .filter(event => {
        const eventDate = new Date(event.start_time);
        return isBefore(eventDate, today);
      })
      .filter(event => {
        if (!searchTerm) return true;
        return event.title.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return dateB.getTime() - dateA.getTime(); // Mais recentes primeiro
      })
      .slice(0, 20); // Limitar a 20 eventos
  }, [events, searchTerm, today]);

  // Entregas concluídas (vendas marcadas como entregues que NÃO são eventos)
  const completedDeliveries = useMemo(() => {
    return sales
      .filter(sale => {
        // Apenas vendas entregues que NÃO são eventos
        return sale.payment_status === "delivered" && !sale.is_event;
      })
      .filter(sale => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          sale.title.toLowerCase().includes(term) ||
          sale.sale_number.toLowerCase().includes(term) ||
          sale.customers?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.delivery_date || a.updated_at);
        const dateB = new Date(b.delivery_date || b.updated_at);
        return dateB.getTime() - dateA.getTime(); // Mais recentes primeiro
      })
      .slice(0, 20);
  }, [sales, searchTerm]);

  // Eventos concluídos (vendas marcadas como evento E entregues)
  const completedEventSales = useMemo(() => {
    return sales
      .filter(sale => {
        // Apenas vendas que são eventos E foram concluídas
        return sale.payment_status === "delivered" && sale.is_event;
      })
      .filter(sale => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          sale.title.toLowerCase().includes(term) ||
          sale.sale_number.toLowerCase().includes(term) ||
          sale.customers?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.event_date || a.updated_at);
        const dateB = new Date(b.event_date || b.updated_at);
        return dateB.getTime() - dateA.getTime(); // Mais recentes primeiro
      })
      .slice(0, 20);
  }, [sales, searchTerm]);

  // Próximos eventos (vendas marcadas como is_event com event_date futuro ou hoje, NÃO concluídas)
  const upcomingEventSales = useMemo(() => {
    return sales
      .filter(sale => {
        // Apenas vendas marcadas como evento com event_date
        if (!sale.is_event || !sale.event_date) return false;
        // Excluir vendas já concluídas
        if (sale.payment_status === "delivered") return false;
        const eventDate = startOfDay(new Date(sale.event_date));
        // Verificar se é futuro ou hoje
        return !isBefore(eventDate, today);
      })
      .filter(sale => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          sale.title.toLowerCase().includes(term) ||
          sale.sale_number.toLowerCase().includes(term) ||
          sale.customers?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.event_date!);
        const dateB = new Date(b.event_date!);
        return dateA.getTime() - dateB.getTime(); // Mais próximos primeiro
      });
  }, [sales, searchTerm, today]);

  // Reuniões futuras (calendar_events que NÃO estão vinculados a vendas)
  const upcomingMeetings = useMemo(() => {
    return filteredEvents
      .filter((event) => {
        // Apenas eventos que NÃO estão vinculados a vendas
        if (event.sale_id) return false;
        const eventDate = startOfDay(new Date(event.start_time));
        // Apenas futuros ou hoje
        return !isBefore(eventDate, today);
      })
      .filter((event) => {
        if (!searchTerm) return true;
        return event.title.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredEvents, searchTerm, today]);

  // Reuniões passadas/concluídas
  const completedMeetings = useMemo(() => {
    return events
      .filter((event) => {
        if (event.sale_id) return false;
        const eventDate = startOfDay(new Date(event.start_time));
        return isBefore(eventDate, today);
      })
      .filter((event) => {
        if (!searchTerm) return true;
        return event.title.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 20);
  }, [events, searchTerm, today]);

  // Resumo do mês atual - eventos (vendas), pedidos e reuniões
  const monthlyEventsSummary = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Eventos do mês vindos de VENDAS (is_event)
    const eventosVendasDoMes = sales.filter((sale) => {
      if (!sale.is_event || !sale.event_date) return false;
      // Excluir eventos concluídos
      if (sale.payment_status === "delivered") return false;
      const eventDate = new Date(sale.event_date);
      return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
    }).length;

    // Reuniões do mês vindas da AGENDA (calendar_events) que NÃO estão vinculados a uma venda
    const reunioesDoMes = filteredEvents.filter((event) => {
      if (event.sale_id) return false;
      const eventDate = new Date(event.start_time);
      return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
    }).length;

    // Pedidos (entregas que não são eventos) no mês
    const pedidosDoMes = sales.filter((sale) => {
      if (sale.is_event || !sale.delivery_date) return false;
      // Excluir pedidos concluídos
      if (sale.payment_status === "delivered") return false;
      const deliveryDate = new Date(sale.delivery_date);
      return isWithinInterval(deliveryDate, { start: monthStart, end: monthEnd });
    }).length;

    return {
      eventos: eventosVendasDoMes,
      reunioes: reunioesDoMes,
      pedidos: pedidosDoMes,
    };
  }, [sales, filteredEvents, currentDate]);

  // Total de eventos futuros (todos os meses)
  const totalFutureEvents = useMemo(() => {
    // Eventos de vendas futuros
    const eventosVendasFuturos = sales.filter((sale) => {
      if (!sale.is_event || !sale.event_date) return false;
      if (sale.payment_status === "delivered") return false;
      const eventDate = startOfDay(new Date(sale.event_date));
      return !isBefore(eventDate, today);
    }).length;

    // Reuniões futuras (não vinculadas a vendas)
    const reunioesFuturas = filteredEvents.filter((event) => {
      if (event.sale_id) return false;
      const eventDate = startOfDay(new Date(event.start_time));
      return !isBefore(eventDate, today);
    }).length;

    // Pedidos futuros (entregas que não são eventos)
    const pedidosFuturos = sales.filter((sale) => {
      if (sale.is_event || !sale.delivery_date) return false;
      if (sale.payment_status === "delivered") return false;
      const deliveryDate = startOfDay(new Date(sale.delivery_date));
      return !isBefore(deliveryDate, today);
    }).length;

    return {
      eventos: eventosVendasFuturos,
      reunioes: reunioesFuturas,
      pedidos: pedidosFuturos,
      total: eventosVendasFuturos + reunioesFuturas + pedidosFuturos,
    };
  }, [sales, filteredEvents, today]);

  // Marcar venda como entregue
  const markDeliveredMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from("sales")
        .update({ payment_status: "delivered" })
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-calendar"] });
      toast.success("Pedido marcado como entregue!");
    },
    onError: () => {
      toast.error("Erro ao atualizar pedido");
    },
  });

  // Reverter entrega para pendente
  const revertDeliveryMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from("sales")
        .update({ payment_status: "pending" })
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-calendar"] });
      toast.success("Pedido voltou para entregas pendentes!");
    },
    onError: () => {
      toast.error("Erro ao atualizar pedido");
    },
  });

  const handleEventClick = (event: CalendarEvent) => {
    // Se o evento tem uma venda associada, navega para a página da venda
    if (event.sale_id) {
      navigate(`/sales?view=${event.sale_id}`);
      return;
    }
    // Caso contrário, abre o dialog de edição do evento
    setSelectedEvent(event);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const handleAddEvent = (date: Date) => {
    setSelectedEvent(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedEvent(null);
      setSelectedDate(undefined);
    }
  };

  const getDeliveryStatus = (deliveryDate: string) => {
    const date = new Date(deliveryDate);
    if (isBefore(date, today)) return "overdue";
    if (isSameDay(date, today)) return "today";
    return "upcoming";
  };

  // Contadores para badges
  const overdueCount = pendingDeliveries.filter(
    sale => getDeliveryStatus(sale.delivery_date!) === "overdue"
  ).length;
  const todayCount = pendingDeliveries.filter(
    sale => getDeliveryStatus(sale.delivery_date!) === "today"
  ).length;

  return (
    <div className="space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div className="overflow-hidden">
        <h1 className="text-2xl md:text-3xl font-bold truncate">Agenda</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">Gerencie seus compromissos e entregas</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, venda ou evento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full overflow-x-hidden">
        {/* Mobile: Select dropdown */}
        <MobileTabSelect
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "calendar", label: "Calendário", icon: <CalendarIcon className="h-4 w-4" /> },
            { 
              value: "meetings", 
              label: "Reuniões", 
              icon: <Users className="h-4 w-4" />,
              badge: upcomingMeetings.length > 0 ? (
                <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-blue-500">
                  {upcomingMeetings.length}
                </Badge>
              ) : undefined
            },
            { 
              value: "events", 
              label: "Eventos", 
              icon: <PartyPopper className="h-4 w-4" />,
              badge: upcomingEventSales.length > 0 ? (
                <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                  {upcomingEventSales.length}
                </Badge>
              ) : undefined
            },
            { 
              value: "deliveries", 
              label: "Entregas", 
              icon: <Package className="h-4 w-4" />,
              badge: (overdueCount > 0 || todayCount > 0) ? (
                <Badge variant={overdueCount > 0 ? "destructive" : "default"} className="ml-1 h-5 px-1.5 text-xs">
                  {pendingDeliveries.length}
                </Badge>
              ) : undefined
            },
            { value: "completed", label: "Concluídos", icon: <CheckCircle2 className="h-4 w-4" /> },
          ]}
          className="sm:hidden"
        />

        {/* Desktop: Regular tabs */}
        <TabsList className="hidden sm:grid sm:w-full sm:grid-cols-5">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="meetings" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Reuniões</span>
            {upcomingMeetings.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-blue-500">
                {upcomingMeetings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4" />
            <span>Eventos</span>
            {upcomingEventSales.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                {upcomingEventSales.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Entregas</span>
            {(overdueCount > 0 || todayCount > 0) && (
              <Badge variant={overdueCount > 0 ? "destructive" : "default"} className="ml-1 h-5 px-1.5 text-xs">
                {pendingDeliveries.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Concluídos</span>
          </TabsTrigger>
        </TabsList>

        {/* Calendário */}
        <TabsContent value="calendar" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3 overflow-x-auto">
              <CalendarView
                events={filteredEvents}
                services={services}
                view={view}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onViewChange={setView}
                onEventClick={handleEventClick}
                onAddEvent={handleAddEvent}
              />
            </div>
            
            <div className="lg:col-span-1 space-y-4">
              {/* Resumo Total Futuros */}
              <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-primary" />
                    Total Futuros
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Todos os compromissos pendentes
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Reuniões</span>
                    </div>
                    <Badge className="bg-blue-500 hover:bg-blue-600">
                      {totalFutureEvents.reunioes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Eventos</span>
                    </div>
                    <Badge className="bg-purple-500 hover:bg-purple-600">
                      {totalFutureEvents.eventos}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Pedidos</span>
                    </div>
                    <Badge variant="default">
                      {totalFutureEvents.pedidos}
                    </Badge>
                  </div>
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive font-medium">
                        {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumo do Mês */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    Resumo do Mês
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Reuniões</span>
                    </div>
                    <Badge variant="outline">
                      {monthlyEventsSummary.reunioes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Eventos</span>
                    </div>
                    <Badge variant="outline">
                      {monthlyEventsSummary.eventos}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm">Pedidos</span>
                    </div>
                    <Badge variant="outline">
                      {monthlyEventsSummary.pedidos}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Próximas Reuniões */}
        <TabsContent value="meetings" className="mt-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Próximas Reuniões
                {upcomingMeetings.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {upcomingMeetings.length} reunião{upcomingMeetings.length > 1 ? "ões" : ""}
                  </Badge>
                )}
              </CardTitle>
              <Button 
                size="sm" 
                className="bg-blue-500 hover:bg-blue-600"
                onClick={() => handleAddEvent(new Date())}
              >
                <Users className="h-4 w-4 mr-1" />
                Nova Reunião
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhuma reunião agendada</p>
                  <p className="text-sm">Clique em "Nova Reunião" para agendar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.map((meeting) => {
                    const meetingDate = new Date(meeting.start_time);
                    const isTodayMeeting = isSameDay(meetingDate, today);
                    return (
                      <div
                        key={meeting.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                          isTodayMeeting && "bg-blue-500/5 border-blue-500/30"
                        )}
                        onClick={() => handleEventClick(meeting)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${meeting.color || '#3b82f6'}20` }}
                          >
                            <Users className="h-5 w-5" style={{ color: meeting.color || '#3b82f6' }} />
                          </div>
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            {meeting.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {meeting.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={isTodayMeeting ? "default" : "outline"}
                                className={cn("text-xs", isTodayMeeting && "bg-blue-500")}
                              >
                                {isTodayMeeting ? "Hoje" : format(meetingDate, "dd/MM/yyyy", { locale: ptBR })}
                              </Badge>
                              {!meeting.all_day && (
                                <span className="text-xs text-muted-foreground">
                                  {format(meetingDate, "HH:mm")}
                                  {meeting.end_time && ` - ${format(new Date(meeting.end_time), "HH:mm")}`}
                                </span>
                              )}
                              {meeting.all_day && (
                                <span className="text-xs text-muted-foreground">Dia inteiro</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Próximos Eventos */}
        <TabsContent value="events" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-primary" />
                Próximos Eventos
                {upcomingEventSales.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {upcomingEventSales.length} evento{upcomingEventSales.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEventSales.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <PartyPopper className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum evento agendado</p>
                  <p className="text-sm">Quando você tiver eventos futuros, eles aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEventSales.map((sale) => {
                    const eventDate = new Date(sale.event_date!);
                    const isToday = isSameDay(eventDate, today);
                    return (
                      <div
                        key={sale.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors",
                          isToday && "bg-primary/5 border-primary/30"
                        )}
                      >
                        <div 
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => navigate(`/sales?view=${sale.id}`)}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500/20">
                            <PartyPopper className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium">{sale.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {sale.customers?.name || "Cliente não informado"} • {sale.sale_number}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={isToday ? "default" : "outline"}
                                className="text-xs"
                              >
                                {isToday ? "Hoje" : format(eventDate, "dd/MM/yyyy", { locale: ptBR })}
                              </Badge>
                              {sale.total && (
                                <span className="text-xs text-muted-foreground">
                                  R$ {sale.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            markDeliveredMutation.mutate(sale.id);
                          }}
                          disabled={markDeliveredMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline">Concluído</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pedidos para Entregar */}
        <TabsContent value="deliveries" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Pedidos para Entregar
                {pendingDeliveries.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {pendingDeliveries.length} pendente{pendingDeliveries.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDeliveries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum pedido pendente</p>
                  <p className="text-sm">Quando você tiver entregas agendadas, elas aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDeliveries.map((sale) => {
                    const status = getDeliveryStatus(sale.delivery_date!);
                    return (
                      <div
                        key={sale.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors",
                          status === "overdue" && "bg-destructive/5 border-destructive/30",
                          status === "today" && "bg-amber-500/5 border-amber-500/30",
                          status === "upcoming" && "bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            status === "overdue" && "bg-destructive/20 text-destructive",
                            status === "today" && "bg-amber-500/20 text-amber-600",
                            status === "upcoming" && "bg-primary/20 text-primary"
                          )}>
                            {status === "overdue" ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : (
                              <Package className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{sale.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {sale.customers?.name || "Cliente não informado"} • {sale.sale_number}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  status === "overdue" && "border-destructive text-destructive",
                                  status === "today" && "border-amber-500 text-amber-600"
                                )}
                              >
                                {status === "overdue" && "Atrasado"}
                                {status === "today" && "Entregar Hoje"}
                                {status === "upcoming" && format(new Date(sale.delivery_date!), "dd/MM/yyyy", { locale: ptBR })}
                              </Badge>
                              {sale.total && (
                                <span className="text-xs text-muted-foreground">
                                  R$ {sale.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={status === "overdue" ? "destructive" : "default"}
                          className="gap-2"
                          onClick={() => markDeliveredMutation.mutate(sale.id)}
                          disabled={markDeliveredMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline">Entregue</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Concluídos */}
        <TabsContent value="completed" className="mt-6">
          <div className="space-y-6">
            {/* Reuniões Concluídas */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Reuniões Passadas
                  {completedMeetings.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {completedMeetings.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedMeetings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma reunião passada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleEventClick(meeting)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500" />
                          <div>
                            <p className="font-medium text-sm">{meeting.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(meeting.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entregas Concluídas */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Entregas Concluídas
                  {completedDeliveries.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {completedDeliveries.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedDeliveries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma entrega concluída</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedDeliveries.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => navigate(`/sales?view=${sale.id}`)}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-green-500" />
                          <div>
                            <p className="font-medium text-sm">{sale.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.customers?.name || "Cliente não informado"} • {sale.sale_number}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              revertDeliveryMutation.mutate(sale.id);
                            }}
                            disabled={revertDeliveryMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                            <span className="hidden sm:inline">Desfazer</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Eventos Concluídos */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  Eventos Concluídos
                  {completedEventSales.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {completedEventSales.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedEventSales.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PartyPopper className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhum evento concluído</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedEventSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => navigate(`/sales?view=${sale.id}`)}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-purple-500" />
                          <div>
                            <p className="font-medium text-sm">{sale.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.customers?.name || "Cliente não informado"} • {sale.sale_number}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              revertDeliveryMutation.mutate(sale.id);
                            }}
                            disabled={revertDeliveryMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                            <span className="hidden sm:inline">Desfazer</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        event={selectedEvent}
        selectedDate={selectedDate}
      />
    </div>
  );
}
