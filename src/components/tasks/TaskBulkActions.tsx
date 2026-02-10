import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Task, TaskStatus, TaskPriority, PRIORITY_CONFIG } from "./types";
import { cn } from "@/lib/utils";

interface TaskBulkActionsProps {
  selectedIds: string[];
  tasks: Task[];
  statuses: TaskStatus[];
  onClearSelection: () => void;
}

export function TaskBulkActions({ 
  selectedIds, 
  tasks,
  statuses, 
  onClearSelection 
}: TaskBulkActionsProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const updateTasks = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${selectedIds.length} tarefas atualizadas`);
      onClearSelection();
    },
    onError: () => toast.error("Erro ao atualizar tarefas"),
  });

  const deleteTasks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${selectedIds.length} tarefas excluídas`);
      onClearSelection();
    },
    onError: () => toast.error("Erro ao excluir tarefas"),
  });

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-background border rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedIds.length} selecionada{selectedIds.length > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Change Status */}
        <Select
          onValueChange={(v) => updateTasks.mutate({ status_id: v === "none" ? null : v })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Alterar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem status</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status.id} value={status.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  />
                  {status.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Change Priority */}
        <Select
          onValueChange={(v) => updateTasks.mutate({ priority: v as TaskPriority })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: config.color }}
                  />
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Delete */}
        {!isDeleting ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => setIsDeleting(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Excluir
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">Confirmar?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7"
              onClick={() => deleteTasks.mutate()}
            >
              <Check className="h-3 w-3 mr-1" />
              Sim
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setIsDeleting(false)}
            >
              Não
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
