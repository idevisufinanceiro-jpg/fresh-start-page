import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface TaskStatus {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_completed_status: boolean;
  hides_overdue: boolean;
  order_index: number;
}

interface TaskStatusManagerProps {
  statuses: TaskStatus[];
}

const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", 
  "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"
];

export function TaskStatusManager({ statuses }: TaskStatusManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(DEFAULT_COLORS[0]);

  const createStatus = useMutation({
    mutationFn: async () => {
      const maxOrder = Math.max(0, ...statuses.map(s => s.order_index));
      const { error } = await supabase.from("task_statuses").insert({
        user_id: user!.id,
        name: newStatusName,
        color: newStatusColor,
        order_index: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      setNewStatusName("");
      toast.success("Status criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar status"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskStatus> }) => {
      const { error } = await supabase
        .from("task_statuses")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_statuses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Status excluído!");
    },
    onError: () => toast.error("Erro ao excluir status"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new status */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Nome do Status</Label>
            <Input
              placeholder="Ex: Em Andamento"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-1 mt-1">
              {DEFAULT_COLORS.map(color => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full border-2 ${
                    newStatusColor === color ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewStatusColor(color)}
                />
              ))}
            </div>
          </div>
          <Button 
            onClick={() => createStatus.mutate()} 
            disabled={!newStatusName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* Status list */}
        <div className="space-y-2">
          {statuses.map(status => (
            <div 
              key={status.id} 
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              
              <input
                type="color"
                value={status.color}
                onChange={(e) => updateStatus.mutate({ 
                  id: status.id, 
                  updates: { color: e.target.value } 
                })}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              
              <Input
                value={status.name}
                onChange={(e) => updateStatus.mutate({ 
                  id: status.id, 
                  updates: { name: e.target.value } 
                })}
                className="flex-1"
              />

              <div className="flex items-center gap-2">
                <Switch
                  id={`completed-${status.id}`}
                  checked={status.is_completed_status}
                  onCheckedChange={(checked) => updateStatus.mutate({ 
                    id: status.id, 
                    updates: { is_completed_status: checked } 
                  })}
                />
                <Label htmlFor={`completed-${status.id}`} className="text-xs whitespace-nowrap">
                  Conclusão
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id={`hides-overdue-${status.id}`}
                  checked={status.hides_overdue}
                  onCheckedChange={(checked) => updateStatus.mutate({ 
                    id: status.id, 
                    updates: { hides_overdue: checked } 
                  })}
                />
                <Label htmlFor={`hides-overdue-${status.id}`} className="text-xs whitespace-nowrap">
                  Esconde Atrasado
                </Label>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteStatus.mutate(status.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {statuses.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Nenhum status criado. Adicione status para organizar suas tarefas.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
