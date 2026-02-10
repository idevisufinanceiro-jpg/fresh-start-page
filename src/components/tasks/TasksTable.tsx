import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, 
  Upload, 
  FileText, 
  CalendarIcon, 
  MessageSquare,
  AlertTriangle,
  Clock,
  ExternalLink,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/dateOnly";
import { cn } from "@/lib/utils";

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  is_completed_status: boolean;
}

interface Sale {
  id: string;
  sale_number: string;
  customer?: { name: string } | null;
}

interface Task {
  id: string;
  title: string;
  sale_id: string | null;
  status_id: string | null;
  due_date: string | null;
  notes: string | null;
  contract_url: string | null;
  contract_name: string | null;
  status?: TaskStatus | null;
  sale?: Sale | null;
}

interface TasksTableProps {
  tasks: Task[];
  statuses: TaskStatus[];
  sales: Sale[];
  isCompletedSection?: boolean;
}

export function TasksTable({ tasks, statuses, sales, isCompletedSection }: TasksTableProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída!");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const handleFileUpload = async (taskId: string, file: File) => {
    setUploadingTaskId(taskId);
    try {
      // Use task-based path (shared across users)
      const filePath = `tasks/${taskId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("contracts")
        .getPublicUrl(filePath);

      await updateTask.mutateAsync({
        id: taskId,
        updates: { contract_url: publicUrl, contract_name: file.name },
      });

      toast.success("Contrato enviado com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar contrato");
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleDeleteContract = async (task: Task) => {
    if (!task.contract_url || !task.contract_name) return;
    
    try {
      // Use task-based path (shared across users)
      const filePath = `tasks/${task.id}/${task.contract_name}`;
      await supabase.storage.from("contracts").remove([filePath]);
      
      await updateTask.mutateAsync({
        id: task.id,
        updates: { contract_url: null, contract_name: null },
      });

      toast.success("Contrato excluído com sucesso!");
    } catch (error) {
      toast.error("Erro ao excluir contrato");
    }
  };

  const handleSaveNotes = (taskId: string) => {
    updateTask.mutate({ id: taskId, updates: { notes: notesValue } });
    setEditingNotes(null);
  };

  const getTaskPriorityBadge = (task: Task) => {
    if (!task.due_date || task.status?.is_completed_status) return null;
    
    const dueDate = startOfDay(parseDateOnly(task.due_date));
    const today = startOfDay(new Date());
    
    if (isPast(dueDate) && !isToday(dueDate)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Atrasada
        </Badge>
      );
    }
    
    if (isToday(dueDate)) {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
          <Clock className="h-3 w-3" />
          Hoje
        </Badge>
      );
    }
    
    return null;
  };

  if (tasks.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        {isCompletedSection 
          ? "Nenhuma tarefa concluída ainda." 
          : "Nenhuma tarefa pendente. Crie uma nova tarefa acima!"}
      </p>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Título</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {tasks.map(task => (
            <TableRow 
              key={task.id}
              className={cn(
                isCompletedSection && "opacity-60"
              )}
            >
              {/* Title */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    value={task.title}
                    onChange={(e) => updateTask.mutate({ 
                      id: task.id, 
                      updates: { title: e.target.value } 
                    })}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                  />
                  {getTaskPriorityBadge(task)}
                </div>
              </TableCell>

              {/* Sale */}
              <TableCell>
                <Select
                  value={task.sale_id || "none"}
                  onValueChange={(value) => updateTask.mutate({ 
                    id: task.id, 
                    updates: { sale_id: value === "none" ? null : value } 
                  })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Vincular venda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {sales.map(sale => (
                      <SelectItem key={sale.id} value={sale.id}>
                        {sale.sale_number} - {sale.customer?.name || "Sem cliente"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Select
                  value={task.status_id || "none"}
                  onValueChange={(value) => updateTask.mutate({ 
                    id: task.id, 
                    updates: { status_id: value === "none" ? null : value } 
                  })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue>
                      {task.status ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: task.status.color }}
                          />
                          {task.status.name}
                        </div>
                      ) : (
                        "Selecionar status"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem status</SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Due Date */}
              <TableCell>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !task.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {task.due_date 
                        ? format(parseDateOnly(task.due_date), "dd/MM/yyyy")
                        : "Definir"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={task.due_date ? parseDateOnly(task.due_date) : undefined}
                      onSelect={(date) => updateTask.mutate({ 
                        id: task.id, 
                        updates: { due_date: date ? format(date, "yyyy-MM-dd") : null } 
                      })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </TableCell>

              {/* Contract */}
              <TableCell>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && uploadingTaskId) {
                      handleFileUpload(uploadingTaskId, file);
                    }
                  }}
                />
                {task.contract_url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={task.contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {task.contract_name || "Contrato"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setUploadingTaskId(task.id);
                        fileInputRef.current?.click();
                      }}
                      title="Substituir contrato"
                    >
                      <Upload className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteContract(task)}
                      title="Excluir contrato"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadingTaskId(task.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingTaskId === task.id}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadingTaskId === task.id ? "Enviando..." : "Enviar"}
                  </Button>
                )}
              </TableCell>

              {/* Notes */}
              <TableCell>
                <Popover 
                  open={editingNotes === task.id}
                  onOpenChange={(open) => {
                    if (open) {
                      setEditingNotes(task.id);
                      setNotesValue(task.notes || "");
                    } else {
                      setEditingNotes(null);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={cn(
                        task.notes && "text-primary"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {task.notes ? "Ver" : "Adicionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Digite suas observações..."
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingNotes(null)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleSaveNotes(task.id)}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </TableCell>

              {/* Delete */}
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTask.mutate(task.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Mobile Card View */}
    <div className="md:hidden space-y-3">
      {tasks.map(task => (
        <div 
          key={task.id}
          className={cn(
            "p-3 border rounded-lg space-y-3 bg-card",
            isCompletedSection && "opacity-60"
          )}
        >
          {/* Title Row */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={task.title}
                onChange={(e) => updateTask.mutate({ 
                  id: task.id, 
                  updates: { title: e.target.value } 
                })}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-sm font-medium"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {getTaskPriorityBadge(task)}
                {task.status && (
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ borderColor: task.status.color, color: task.status.color }}
                  >
                    {task.status.name}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => deleteTask.mutate(task.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {/* Status & Sale */}
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={task.status_id || "none"}
              onValueChange={(value) => updateTask.mutate({ 
                id: task.id, 
                updates: { status_id: value === "none" ? null : value } 
              })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem status</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status.id} value={status.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="truncate">{status.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={task.sale_id || "none"}
              onValueChange={(value) => updateTask.mutate({ 
                id: task.id, 
                updates: { sale_id: value === "none" ? null : value } 
              })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Venda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {sales.map(sale => (
                  <SelectItem key={sale.id} value={sale.id}>
                    <span className="truncate">{sale.sale_number}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 text-xs justify-start flex-1 min-w-[120px]",
                    !task.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {task.due_date 
                    ? format(parseDateOnly(task.due_date), "dd/MM/yyyy")
                    : "Prazo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={task.due_date ? parseDateOnly(task.due_date) : undefined}
                  onSelect={(date) => updateTask.mutate({ 
                    id: task.id, 
                    updates: { due_date: date ? format(date, "yyyy-MM-dd") : null } 
                  })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {task.contract_url ? (
              <a
                href={task.contract_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{task.contract_name || "Contrato"}</span>
              </a>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setUploadingTaskId(task.id);
                  fileInputRef.current?.click();
                }}
                disabled={uploadingTaskId === task.id}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploadingTaskId === task.id ? "..." : "Contrato"}
              </Button>
            )}

            <Popover 
              open={editingNotes === task.id}
              onOpenChange={(open) => {
                if (open) {
                  setEditingNotes(task.id);
                  setNotesValue(task.notes || "");
                } else {
                  setEditingNotes(null);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={cn(
                    "h-8 text-xs",
                    task.notes && "text-primary"
                  )}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Obs
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Observações..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingNotes(null)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleSaveNotes(task.id)}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ))}
    </div>
  </>
  );
}
