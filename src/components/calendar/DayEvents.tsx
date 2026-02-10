import { format, isSameDay, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;
type Service = Tables<"services">;

interface DayEventsProps {
  events: CalendarEvent[];
  services: Service[];
  date: Date;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayEvents({ events, services, date, onEventClick }: DayEventsProps) {
  const today = startOfDay(new Date());
  
  // Filter events for this day
  const dayEvents = events.filter(event => 
    isSameDay(new Date(event.start_time), date)
  );

  // Filter services with deadlines on this day
  const dayServices = services.filter(service => 
    service.due_date && isSameDay(new Date(service.due_date), date)
  );

  // Check for overdue
  const isOverdue = (dueDate: string) => {
    return isBefore(new Date(dueDate), today);
  };

  if (dayEvents.length === 0 && dayServices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 mt-1">
      {dayEvents.slice(0, 3).map((event) => (
        <div
          key={event.id}
          className={cn(
            "text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
            "text-white font-medium"
          )}
          style={{ backgroundColor: event.color || "#6366f1" }}
          onClick={(e) => {
            e.stopPropagation();
            onEventClick(event);
          }}
          title={event.title}
        >
          {!event.all_day && (
            <span className="opacity-75 mr-1">
              {format(new Date(event.start_time), "HH:mm")}
            </span>
          )}
          {event.title}
        </div>
      ))}
      
      {dayServices.slice(0, 2).map((service) => (
        <div
          key={service.id}
          className={cn(
            "text-xs px-1.5 py-0.5 rounded truncate",
            "border-l-2 bg-muted/50",
            isOverdue(service.due_date!) && service.status !== "completed"
              ? "border-destructive text-destructive"
              : "border-primary text-primary"
          )}
          title={`Entrega: ${service.title}`}
        >
          📦 {service.title}
        </div>
      ))}

      {(dayEvents.length > 3 || dayServices.length > 2) && (
        <div className="text-xs text-muted-foreground text-center">
          +{dayEvents.length - 3 + Math.max(0, dayServices.length - 2)} mais
        </div>
      )}
    </div>
  );
}
