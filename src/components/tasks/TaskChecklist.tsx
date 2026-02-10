import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { TaskChecklistItem } from "./types";
import { cn } from "@/lib/utils";

interface TaskChecklistProps {
  taskId: string;
  items: TaskChecklistItem[];
}

export function TaskChecklist({ taskId, items }: TaskChecklistProps) {
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");
  
  const completedCount = items.filter(item => item.is_completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const createItem = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) + 1 : 0;
      const { error } = await supabase
        .from("task_checklists")
        .insert({ task_id: taskId, title, order_index: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewItemTitle("");
    },
    onError: () => toast.error("Erro ao adicionar item"),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("task_checklists")
        .update({ is_completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar item"),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_checklists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao excluir item"),
  });

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    createItem.mutate(newItemTitle.trim());
  };

  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-3">
      {/* Progress */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{completedCount}/{totalCount}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1">
        {sortedItems.map(item => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 group p-2 rounded-md hover:bg-muted/50 transition-colors",
              item.is_completed && "opacity-60"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(checked) => toggleItem.mutate({ 
                id: item.id, 
                is_completed: !!checked 
              })}
            />
            <span className={cn(
              "flex-1 text-sm",
              item.is_completed && "line-through text-muted-foreground"
            )}>
              {item.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => deleteItem.mutate(item.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
        <Input
          placeholder="Adicionar item..."
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          className="text-sm"
        />
        <Button 
          size="icon" 
          variant="outline"
          onClick={handleAddItem}
          disabled={!newItemTitle.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
