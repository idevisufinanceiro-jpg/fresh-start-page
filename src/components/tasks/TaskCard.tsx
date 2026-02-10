import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  CalendarIcon, 
  FileText, 
  MessageSquare, 
  GripVertical,
  CheckCircle2,
  User,
  Briefcase
} from "lucide-react";
import { format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/dateOnly";
import { Task, TaskStatus, PRIORITY_CONFIG } from "./types";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskCardProps {
  task: Task;
  statuses: TaskStatus[];
  onOpenDetail: (taskId: string) => void;
  isDragging?: boolean;
}

export function TaskCard({ task, statuses, onOpenDetail, isDragging }: TaskCardProps) {
  const queryClient = useQueryClient();

  const updateTask = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const getDateBadge = () => {
    if (!task.due_date) return null;
    
    // Usa o campo hides_overdue do status
    if (task.status?.hides_overdue || task.status?.is_completed_status) return null;
    
    // DATE "YYYY-MM-DD" precisa ser interpretada como data local (sem shift de timezone)
    const dueDateRaw = parseDateOnly(task.due_date);
    const dueDate = startOfDay(dueDateRaw);
    const today = startOfDay(new Date());
    
    if (dueDate < today) {
      return (
        <Badge variant="destructive" className="text-xs">
          Atrasada
        </Badge>
      );
    }
    
    if (isToday(dueDateRaw)) {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-500/50">
          Hoje
        </Badge>
      );
    }
    
    return null;
  };

  const checklistProgress = task.checklists?.length 
    ? task.checklists.filter(c => c.is_completed).length 
    : 0;
  const checklistTotal = task.checklists?.length || 0;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md group",
        isDragging && "shadow-lg rotate-2 opacity-90",
        task.status?.is_completed_status && "opacity-60"
      )}
      onClick={() => onOpenDetail(task.id)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with drag handle and priority */}
        <div className="flex items-start gap-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-sm leading-tight",
              task.status?.is_completed_status && "line-through"
            )}>
              {task.title}
            </p>
          </div>
          <TaskPriorityBadge priority={task.priority || 'medium'} showLabel={false} size="sm" />
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map(assignment => (
              <Badge
                key={assignment.id}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ 
                  borderColor: assignment.tag?.color,
                  color: assignment.tag?.color
                }}
              >
                {assignment.tag?.name}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {/* Date badge or date */}
          {getDateBadge()}
          {task.due_date && !getDateBadge() && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(parseDateOnly(task.due_date), "dd/MM")}
            </span>
          )}

          {/* Customer */}
          {task.customer && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.customer.name.split(" ")[0]}
            </span>
          )}

          {/* Sale */}
          {task.sale && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {task.sale.sale_number}
            </span>
          )}

          {/* Checklist progress */}
          {checklistTotal > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {checklistProgress}/{checklistTotal}
            </span>
          )}

          {/* Has contract */}
          {task.contract_url && (
            <FileText className="h-3 w-3" />
          )}

          {/* Has notes */}
          {task.notes && (
            <MessageSquare className="h-3 w-3" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
