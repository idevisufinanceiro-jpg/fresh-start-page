import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceStage = Tables<"service_stages">;

interface StageManagerProps {
  serviceId: string;
}

export function StageManager({ serviceId }: StageManagerProps) {
  const queryClient = useQueryClient();
  const [newStageTitle, setNewStageTitle] = useState("");

  const { data: stages, isLoading } = useQuery({
    queryKey: ["service-stages", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_stages")
        .select("*")
        .eq("service_id", serviceId)
        .order("order_index");
      if (error) throw error;
      return data as ServiceStage[];
    },
  });

  const addStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = stages?.length ? Math.max(...stages.map(s => s.order_index)) : -1;
      const { error } = await supabase
        .from("service_stages")
        .insert({
          service_id: serviceId,
          title,
          order_index: maxOrder + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-stages", serviceId] });
      setNewStageTitle("");
      toast({ title: "Etapa adicionada" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar etapa", variant: "destructive" });
    },
  });

  const toggleStageMutation = useMutation({
    mutationFn: async ({ stageId, isCompleted }: { stageId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("service_stages")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-stages", serviceId] });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from("service_stages")
        .delete()
        .eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-stages", serviceId] });
      toast({ title: "Etapa removida" });
    },
  });

  const handleAddStage = () => {
    if (newStageTitle.trim()) {
      addStageMutation.mutate(newStageTitle.trim());
    }
  };

  const completedCount = stages?.filter(s => s.is_completed).length || 0;
  const totalCount = stages?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Etapas do Projeto</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount}/{totalCount} concluídas ({Math.round(progress)}%)
          </span>
        </CardTitle>
        {totalCount > 0 && (
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nova etapa..."
            value={newStageTitle}
            onChange={(e) => setNewStageTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
          />
          <Button onClick={handleAddStage} disabled={!newStageTitle.trim() || addStageMutation.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {stages?.map((stage) => (
            <div
              key={stage.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                stage.is_completed ? "bg-muted/50 border-muted" : "bg-background border-border"
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Checkbox
                checked={stage.is_completed || false}
                onCheckedChange={(checked) =>
                  toggleStageMutation.mutate({ stageId: stage.id, isCompleted: !!checked })
                }
              />
              <div className="flex-1">
                <p className={stage.is_completed ? "line-through text-muted-foreground" : ""}>
                  {stage.title}
                </p>
                {stage.completed_at && (
                  <p className="text-xs text-muted-foreground">
                    Concluída em {format(new Date(stage.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteStageMutation.mutate(stage.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {stages?.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma etapa cadastrada. Adicione etapas para acompanhar o progresso.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
