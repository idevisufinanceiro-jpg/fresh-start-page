import { useMemo } from "react";
import { isBefore, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;
type Service = Tables<"services">;

interface UpcomingAlertsProps {
  events: CalendarEvent[];
  services: Service[];
  onAlertClick?: (date: Date) => void;
}

export function UpcomingAlerts({ events, services, onAlertClick }: UpcomingAlertsProps) {
  const today = startOfDay(new Date());

  const alerts = useMemo(() => {
    const items: Array<{
      id: string;
      type: "event" | "deadline" | "overdue";
      title: string;
      date: Date;
      color?: string;
    }> = [];

    // Overdue services
    services.forEach((service) => {
      if (service.due_date && service.status !== "completed") {
        const dueDate = new Date(service.due_date);
        if (isBefore(dueDate, today)) {
          items.push({
            id: `overdue-${service.id}`,
            type: "overdue",
            title: service.title,
            date: dueDate,
          });
        } else {
          items.push({
            id: `deadline-${service.id}`,
            type: "deadline",
            title: service.title,
            date: dueDate,
          });
        }
      }
    });

    // ALL upcoming events (not just next 7 days)
    events.forEach((event) => {
      const eventDate = new Date(event.start_time);
      if (!isBefore(eventDate, today)) {
        items.push({
          id: `event-${event.id}`,
          type: "event",
          title: event.title,
          date: eventDate,
          color: event.color || undefined,
        });
      }
    });

    // Sort by date, overdue first
    return items.sort((a, b) => {
      if (a.type === "overdue" && b.type !== "overdue") return -1;
      if (a.type !== "overdue" && b.type === "overdue") return 1;
      return a.date.getTime() - b.date.getTime();
    });
  }, [events, services, today]);

  const overdueCount = alerts.filter(a => a.type === "overdue").length;

  return (
    <Card className={cn(
      "shadow-card",
      overdueCount > 0 && "border-destructive/50"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {overdueCount > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">Alertas e Lembretes</span>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-primary" />
              Próximos Eventos
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => onAlertClick?.(alert.date)}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80",
              alert.type === "overdue" 
                ? "bg-destructive/10 border border-destructive/30"
                : alert.type === "deadline"
                  ? "bg-amber-500/10 border border-amber-500/30"
                  : "bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              {alert.type === "event" && alert.color && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: alert.color }}
                />
              )}
              {alert.type === "overdue" && (
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              {alert.type === "deadline" && (
                <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              )}
              <div>
                <p className={cn(
                  "font-medium text-sm",
                  alert.type === "overdue" && "text-destructive"
                )}>
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {alert.type === "overdue" 
                    ? "Atrasado" 
                    : format(alert.date, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })
                  }
                </p>
              </div>
            </div>
            <Badge 
              variant="outline"
              className={cn(
                "text-xs",
                alert.type === "overdue" && "border-destructive text-destructive",
                alert.type === "deadline" && "border-amber-500 text-amber-600",
                alert.type === "event" && "border-primary text-primary"
              )}
            >
              {alert.type === "event" 
                ? format(alert.date, "HH:mm")
                : format(alert.date, "dd/MM")
              }
            </Badge>
          </div>
        ))}

      </CardContent>
    </Card>
  );
}
