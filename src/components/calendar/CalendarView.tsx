import { useState, useMemo } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  isBefore,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DayEvents } from "./DayEvents";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;
type Service = Tables<"services">;

export type CalendarView = "month" | "week" | "day";

interface CalendarViewProps {
  events: CalendarEvent[];
  services: Service[];
  view: CalendarView;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarView({
  events,
  services,
  view,
  currentDate,
  onDateChange,
  onViewChange,
  onEventClick,
  onAddEvent,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);

  const navigate = (direction: "prev" | "next") => {
    let newDate: Date;
    if (view === "month") {
      newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    } else if (view === "week") {
      newDate = direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1);
    } else {
      newDate = direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1);
    }
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
    setSelectedDate(new Date());
  };

  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      return [currentDate];
    }
  }, [currentDate, view]);

  const getTitle = () => {
    if (view === "month") {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "dd")} - ${format(end, "dd 'de' MMMM", { locale: ptBR })}`;
    } else {
      return format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (view === "month") {
      onDateChange(day);
      onViewChange("day");
    }
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
            <h2 className="text-lg font-semibold capitalize ml-2">
              {getTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewChange(v)}
                  className={cn(
                    "text-xs",
                    view === v && "bg-gradient-primary"
                  )}
                >
                  {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
                </Button>
              ))}
            </div>
            <Button 
              size="sm" 
              className="bg-gradient-primary"
              onClick={() => onAddEvent(selectedDate)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Reunião
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        {view === "month" && (
          <div>
            {/* Week days header */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] p-1 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                    !isSameMonth(day, currentDate) && "opacity-40",
                    isToday(day) && "bg-primary/5 border-primary",
                    isSameDay(day, selectedDate) && "ring-2 ring-primary"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, "d")}
                  </div>
                  <DayEvents 
                    events={events} 
                    services={services}
                    date={day} 
                    onEventClick={onEventClick}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "week" && (
          <div>
            {/* Week days header */}
            <div className="grid grid-cols-7 mb-2">
              {days.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "text-center py-2 cursor-pointer rounded-lg hover:bg-muted/50",
                    isToday(day) && "bg-primary/10"
                  )}
                  onClick={() => {
                    onDateChange(day);
                    onViewChange("day");
                  }}
                >
                  <div className="text-sm text-muted-foreground">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Week events */}
            <div className="grid grid-cols-7 gap-1 min-h-[400px]">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "p-2 border rounded-lg",
                    isToday(day) && "bg-primary/5 border-primary"
                  )}
                >
                  <DayEvents 
                    events={events} 
                    services={services}
                    date={day} 
                    onEventClick={onEventClick}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "day" && (
          <DayDetailView
            date={currentDate}
            events={events}
            services={services}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface DayDetailViewProps {
  date: Date;
  events: CalendarEvent[];
  services: Service[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
}

function DayDetailView({ date, events, services, onEventClick, onAddEvent }: DayDetailViewProps) {
  const dayEvents = events.filter(event => 
    isSameDay(new Date(event.start_time), date)
  ).sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const dayServices = services.filter(service => 
    service.due_date && isSameDay(new Date(service.due_date), date)
  );

  const today = startOfDay(new Date());
  const isOverdue = (dueDate: string) => isBefore(new Date(dueDate), today);

  // Generate hours
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      {/* All day events */}
      {dayEvents.filter(e => e.all_day).length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Dia inteiro</h4>
          <div className="space-y-1">
            {dayEvents.filter(e => e.all_day).map((event) => (
              <div
                key={event.id}
                className="p-2 rounded cursor-pointer hover:opacity-80 text-white"
                style={{ backgroundColor: event.color || "#6366f1" }}
                onClick={() => onEventClick(event)}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service deadlines */}
      {dayServices.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">📦 Entregas</h4>
          <div className="space-y-1">
            {dayServices.map((service) => (
              <div
                key={service.id}
                className={cn(
                  "p-2 rounded border-l-4",
                  isOverdue(service.due_date!) && service.status !== "completed"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-primary bg-primary/10 text-primary"
                )}
              >
                <div className="font-medium">{service.title}</div>
                <div className="text-xs opacity-75">
                  {service.status === "completed" 
                    ? "✓ Concluído" 
                    : service.status === "in_progress" 
                      ? "Em andamento"
                      : "Agendado"
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time slots */}
      <div className="border rounded-lg overflow-hidden">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter(e => {
            if (e.all_day) return false;
            const eventHour = new Date(e.start_time).getHours();
            return eventHour === hour;
          });

          return (
            <div 
              key={hour} 
              className="flex border-b last:border-b-0 min-h-[48px] hover:bg-muted/30 cursor-pointer"
              onClick={() => {
                const newDate = new Date(date);
                newDate.setHours(hour, 0, 0, 0);
                onAddEvent(newDate);
              }}
            >
              <div className="w-16 flex-shrink-0 p-2 text-xs text-muted-foreground border-r bg-muted/20">
                {format(new Date().setHours(hour, 0), "HH:mm")}
              </div>
              <div className="flex-1 p-1">
                {hourEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 rounded text-white text-sm cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: event.color || "#6366f1" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs opacity-75">
                      {format(new Date(event.start_time), "HH:mm")}
                      {event.end_time && ` - ${format(new Date(event.end_time), "HH:mm")}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
