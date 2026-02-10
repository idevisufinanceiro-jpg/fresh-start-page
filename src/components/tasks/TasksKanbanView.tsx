import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { Task, TaskStatus } from "./types";
import { TaskCard } from "./TaskCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TasksKanbanViewProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onOpenDetail: (taskId: string) => void;
}

export function TasksKanbanView({ tasks, statuses, onOpenDetail }: TasksKanbanViewProps) {
  const queryClient = useQueryClient();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, statusId }: { taskId: string; statusId: string | null }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status_id: statusId })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Erro ao mover tarefa"),
  });

  // Create columns: one for each status + one for "No Status"
  const columns = [
    { id: "no-status", name: "Sem Status", color: "#9ca3af", is_completed_status: false },
    ...statuses.filter(s => !s.is_completed_status).sort((a, b) => a.order_index - b.order_index),
    ...statuses.filter(s => s.is_completed_status).sort((a, b) => a.order_index - b.order_index),
  ];

  const getColumnTasks = (columnId: string) => {
    if (columnId === "no-status") {
      return tasks.filter(t => !t.status_id);
    }
    return tasks.filter(t => t.status_id === columnId);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumnId(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);
    
    if (draggedTaskId) {
      const newStatusId = columnId === "no-status" ? null : columnId;
      const currentTask = tasks.find(t => t.id === draggedTaskId);
      
      // Only update if status actually changed
      if (currentTask && currentTask.status_id !== newStatusId) {
        updateTaskStatus.mutate({ taskId: draggedTaskId, statusId: newStatusId });
      }
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumnId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {columns.map(column => {
        const columnTasks = getColumnTasks(column.id);
        const isOver = dragOverColumnId === column.id;
        
        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-72 flex flex-col rounded-lg border bg-muted/30 transition-colors",
              isOver && "bg-primary/10 border-primary"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-3 border-b flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: column.color }}
              />
              <h3 className="font-medium text-sm flex-1 truncate">{column.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {columnTasks.length}
              </Badge>
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "transition-opacity",
                      draggedTaskId === task.id && "opacity-50"
                    )}
                  >
                    <TaskCard
                      task={task}
                      statuses={statuses}
                      onOpenDetail={onOpenDetail}
                      isDragging={draggedTaskId === task.id}
                    />
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Arraste tarefas aqui
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
