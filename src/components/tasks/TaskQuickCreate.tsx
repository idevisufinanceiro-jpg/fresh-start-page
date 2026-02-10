import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, CalendarIcon, Flag, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TaskStatus, TaskPriority, PRIORITY_CONFIG } from "./types";
import { cn } from "@/lib/utils";

interface TaskQuickCreateProps {
  statuses: TaskStatus[];
  onCreated?: () => void;
}

export function TaskQuickCreate({ statuses, onCreated }: TaskQuickCreateProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isExpanded, setIsExpanded] = useState(false);

  const createTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tasks")
        .insert({
          user_id: user!.id,
          title: title.trim(),
          status_id: statusId,
          priority,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTitle("");
      setDueDate(undefined);
      setPriority("medium");
      setIsExpanded(false);
      toast.success("Tarefa criada!");
      onCreated?.();
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    createTask.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Main input row */}
          <div className="flex gap-2">
            <Input
              placeholder="Nova tarefa... (Enter para criar)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsExpanded(true)}
              className="flex-1"
            />
            <Button 
              onClick={handleSubmit} 
              disabled={!title.trim() || createTask.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Expanded options */}
          {isExpanded && (
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status selector */}
              <Select
                value={statusId || "none"}
                onValueChange={(v) => setStatusId(v === "none" ? null : v)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
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

              {/* Priority selector */}
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue>
                    <div className="flex items-center gap-1.5">
                      <Flag 
                        className="h-3 w-3" 
                        style={{ color: PRIORITY_CONFIG[priority].color }}
                      />
                      {PRIORITY_CONFIG[priority].label}
                    </div>
                  </SelectValue>
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

              {/* Due date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1.5" />
                    {dueDate ? format(dueDate, "dd/MM") : "Prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              {/* Collapse button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs ml-auto"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                Menos
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
