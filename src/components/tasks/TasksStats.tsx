import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { isToday, startOfDay } from "date-fns";
import { parseDateOnly } from "@/lib/dateOnly";

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  is_completed_status: boolean;
  hides_overdue: boolean;
}

interface Task {
  id: string;
  due_date: string | null;
  status?: TaskStatus | null;
  created_at?: string;
}

interface TasksStatsProps {
  tasks: Task[];
}

export function TasksStats({ tasks }: TasksStatsProps) {
  const pendingTasks = tasks.filter(t => !t.status?.is_completed_status);
  const completedTasks = tasks.filter(t => t.status?.is_completed_status);
  
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.due_date) return false;
    
    // Usa o campo hides_overdue do status
    if (t.status?.hides_overdue || t.status?.is_completed_status) return false;
    
    // DATE "YYYY-MM-DD" precisa ser interpretada como data local (sem shift de timezone)
    const dueDateRaw = parseDateOnly(t.due_date);
    const dueDate = startOfDay(dueDateRaw);
    const today = startOfDay(new Date());
    return dueDate < today;
  });

  const dueTodayTasks = pendingTasks.filter(t => {
    if (!t.due_date) return false;
    return isToday(parseDateOnly(t.due_date));
  });

  // Only show 4 main stats, no per-status cards
  const stats = [
    { label: "Pendentes", value: pendingTasks.length, color: "#3b82f6", icon: ListTodo, badge: "Ativas" },
    { label: "Concluídas", value: completedTasks.length, color: "#22c55e", icon: CheckCircle2, badge: "Feitas" },
    { label: "Para Hoje", value: dueTodayTasks.length, color: "#eab308", icon: Clock, badge: "Urgente" },
    { label: "Atrasadas", value: overdueTasks.length, color: "#ef4444", icon: AlertTriangle, badge: "Alerta" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div 
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {stat.badge}
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
