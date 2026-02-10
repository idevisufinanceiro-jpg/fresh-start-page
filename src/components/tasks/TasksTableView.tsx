import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  CalendarIcon, 
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/dateOnly";
import { cn } from "@/lib/utils";
import { Task, TaskStatus, Sale, ViewMode, PRIORITY_CONFIG } from "./types";
import { TaskPriorityBadge } from "./TaskPriorityBadge";

interface TasksTableViewProps {
  tasks: Task[];
  statuses: TaskStatus[];
  sales: Sale[];
  viewMode: ViewMode;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenDetail: (taskId: string) => void;
}

export function TasksTableView({ 
  tasks, 
  statuses, 
  sales,
  viewMode,
  selectedIds,
  onSelectionChange,
  onOpenDetail
}: TasksTableViewProps) {
  const { user } = useAuth();
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

  const toggleAll = (tasksList: Task[]) => {
    const taskIds = tasksList.map(t => t.id);
    const allSelected = taskIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onSelectionChange(selectedIds.filter(id => !taskIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...taskIds])]);
    }
  };

  const getDateBadge = (task: Task) => {
    if (!task.due_date) return null;
    
    // Usa o campo hides_overdue do status
    if (task.status?.hides_overdue || task.status?.is_completed_status) return null;
    
    // DATE "YYYY-MM-DD" precisa ser interpretada como data local (sem shift de timezone)
    const dueDateRaw = parseDateOnly(task.due_date);
    const dueDate = startOfDay(dueDateRaw);
    const today = startOfDay(new Date());
    
    if (dueDate < today) {
      return <Badge variant="destructive" className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>;
    }
    if (isToday(dueDateRaw)) {
      return <Badge variant="outline" className="gap-1 text-xs border-yellow-500 text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-500/50"><Clock className="h-3 w-3" />Hoje</Badge>;
    }
    return null;
  };

  const renderTaskRow = (task: Task, isCompleted: boolean) => (
    <TableRow 
      key={task.id}
      className={cn("cursor-pointer hover:bg-muted/50", isCompleted && "opacity-60")}
      onClick={() => onOpenDetail(task.id)}
    >
      <TableCell onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={selectedIds.includes(task.id)}
          onCheckedChange={() => toggleSelection(task.id)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", isCompleted && "line-through")}>{task.title}</span>
          {getDateBadge(task)}
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 2).map(t => (
                <Badge key={t.id} variant="outline" className="text-[10px] px-1" style={{ borderColor: t.tag?.color, color: t.tag?.color }}>
                  {t.tag?.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <TaskPriorityBadge priority={task.priority || 'medium'} size="sm" />
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <Select
          value={task.status_id || "none"}
          onValueChange={(v) => updateTask.mutate({ id: task.id, updates: { status_id: v === "none" ? null : v } })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue>
              {task.status ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.status.color }} />
                  {task.status.name}
                </div>
              ) : "Sem status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem status</SelectItem>
            {statuses.map(s => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={cn("h-8 text-xs", !task.due_date && "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3 mr-1" />
              {task.due_date ? format(parseDateOnly(task.due_date), "dd/MM") : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.due_date ? parseDateOnly(task.due_date) : undefined}
              onSelect={(date) => updateTask.mutate({ id: task.id, updates: { due_date: date ? format(date, "yyyy-MM-dd") : null } })}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );

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
    <div className="space-y-6">
      {/* Pending Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            Tarefas Pendentes
            <Badge variant="secondary">{pendingTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pendingTasks.length > 0 && pendingTasks.every(t => selectedIds.includes(t.id))}
                      onCheckedChange={() => toggleAll(pendingTasks)}
                    />
                  </TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-[100px]">Prioridade</TableHead>
                  <TableHead className="w-[160px]">Status</TableHead>
                  <TableHead className="w-[100px]">Prazo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPendingTasks.map(task => renderTaskRow(task, false))}
                {pendingTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma tarefa pendente
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
              Tarefas Concluídas
              <Badge variant="outline">{completedTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={completedTasks.every(t => selectedIds.includes(t.id))}
                        onCheckedChange={() => toggleAll(completedTasks)}
                      />
                    </TableHead>
                    <TableHead>Tarefa</TableHead>
                    <TableHead className="w-[100px]">Prioridade</TableHead>
                    <TableHead className="w-[160px]">Status</TableHead>
                    <TableHead className="w-[100px]">Prazo</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTasks.map(task => renderTaskRow(task, true))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
