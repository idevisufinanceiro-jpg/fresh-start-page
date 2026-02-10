import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  AlertTriangle,
  Clock,
  ChevronRight,
  User,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/dateOnly";
import { Task, TaskStatus, Sale, PRIORITY_CONFIG } from "./types";

interface TasksListViewProps {
  tasks: Task[];
  statuses: TaskStatus[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenDetail: (taskId: string) => void;
}

export function TasksListView({ 
  tasks, 
  statuses,
  selectedIds,
  onSelectionChange,
  onOpenDetail
}: TasksListViewProps) {
  const queryClient = useQueryClient();

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const pendingTasks = tasks.filter(t => !t.status?.is_completed_status);
  const completedTasks = tasks.filter(t => t.status?.is_completed_status);

  // Sort pending: overdue first, then today, then by due_date
  const sortedPendingTasks = [...pendingTasks].sort((a, b) => {
    const aDate = a.due_date ? startOfDay(parseDateOnly(a.due_date)) : null;
    const bDate = b.due_date ? startOfDay(parseDateOnly(b.due_date)) : null;
    const aOverdue = aDate && isPast(aDate) && !isToday(aDate);
    const bOverdue = bDate && isPast(bDate) && !isToday(bDate);
    const aDueToday = aDate && isToday(aDate);
    const bDueToday = bDate && isToday(bDate);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aDueToday && !bDueToday) return -1;
    if (!aDueToday && bDueToday) return 1;
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return 0;
  });

  const toggleSelection = (taskId: string) => {
    if (selectedIds.includes(taskId)) {
      onSelectionChange(selectedIds.filter(id => id !== taskId));
    } else {
      onSelectionChange([...selectedIds, taskId]);
    }
  };

  const getDateInfo = (task: Task) => {
    if (!task.due_date) return null;
    
    // DATE "YYYY-MM-DD" precisa ser interpretada como data local (sem shift de timezone)
    const dueDateRaw = parseDateOnly(task.due_date);
    const dueDate = startOfDay(dueDateRaw);
    const today = startOfDay(new Date());
    
    // Usa o campo hides_overdue do status
    const shouldHide = task.status?.hides_overdue || task.status?.is_completed_status;
    
    const isOverdue = !shouldHide && dueDate < today;
    const isDueToday = !shouldHide && isToday(dueDateRaw);
    
    return {
      formatted: format(dueDateRaw, "dd/MM"),
      isOverdue,
      isDueToday
    };
  };

  const getPriorityDot = (priority: string) => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
    return <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />;
  };

  const renderTaskItem = (task: Task, isCompleted: boolean) => {
    const dateInfo = getDateInfo(task);
    const checklistTotal = task.checklists?.length || 0;
    const checklistDone = task.checklists?.filter(c => c.is_completed).length || 0;

    return (
      <div
        key={task.id}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors",
          isCompleted && "opacity-60"
        )}
        onClick={() => onOpenDetail(task.id)}
      >
        {/* Checkbox */}
        <div onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.includes(task.id)}
            onCheckedChange={() => toggleSelection(task.id)}
          />
        </div>

        {/* Priority dot */}
        {getPriorityDot(task.priority || 'medium')}

        {/* Status indicator */}
        {task.status && (
          <div 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: task.status.color }}
            title={task.status.name}
          />
        )}

        {/* Title */}
        <span className={cn("flex-1 truncate text-sm", isCompleted && "line-through text-muted-foreground")}>
          {task.title}
        </span>

        {/* Tags (max 1) */}
        {task.tags && task.tags.length > 0 && (
          <Badge 
            variant="outline" 
            className="text-[10px] px-1.5 py-0 hidden sm:inline-flex"
            style={{ borderColor: task.tags[0].tag?.color, color: task.tags[0].tag?.color }}
          >
            {task.tags[0].tag?.name}
          </Badge>
        )}

        {/* Customer */}
        {task.customer && (
          <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="max-w-[80px] truncate">{task.customer.name}</span>
          </div>
        )}

        {/* Checklist progress */}
        {checklistTotal > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>{checklistDone}/{checklistTotal}</span>
          </div>
        )}

        {/* Due date */}
        {dateInfo && (
          <div className={cn(
            "flex items-center gap-1 text-xs shrink-0",
            dateInfo.isOverdue && "text-destructive",
            dateInfo.isDueToday && "text-yellow-600",
            !dateInfo.isOverdue && !dateInfo.isDueToday && "text-muted-foreground"
          )}>
            {dateInfo.isOverdue && <AlertTriangle className="h-3 w-3" />}
            {dateInfo.isDueToday && <Clock className="h-3 w-3" />}
            {!dateInfo.isOverdue && !dateInfo.isDueToday && <CalendarIcon className="h-3 w-3" />}
            <span>{dateInfo.formatted}</span>
          </div>
        )}

        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma tarefa encontrada. Crie uma nova tarefa acima!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Tasks */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            Pendentes
            <Badge variant="secondary" className="text-xs">{pendingTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedPendingTasks.length > 0 ? (
            sortedPendingTasks.map(task => renderTaskItem(task, false))
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma tarefa pendente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Concluídas
              <Badge variant="outline" className="text-xs">{completedTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {completedTasks.map(task => renderTaskItem(task, true))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
