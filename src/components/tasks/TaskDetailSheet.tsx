import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { 
  CalendarIcon, 
  Trash2, 
  Upload, 
  FileText, 
  ExternalLink,
  X,
  User,
  Briefcase,
  Copy,
  Pencil,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/dateOnly";
import { toast } from "sonner";
import { Task, TaskStatus, Sale, Customer, Service, PRIORITY_CONFIG, TaskPriority } from "./types";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskChecklist } from "./TaskChecklist";
import { TaskTagsManager } from "./TaskTagsManager";
import { TaskTimeTracker } from "./TaskTimeTracker";
import { cn } from "@/lib/utils";

interface TaskDetailSheetProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  statuses: TaskStatus[];
  sales: Sale[];
  customers: Customer[];
  services: Service[];
}

// Custom hook for debounced notes
function useDebouncedNotes(task: Task | null, updateTask: (updates: Partial<Task>) => void) {
  const [localNotes, setLocalNotes] = useState(task?.notes || "");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalNotes(task?.notes || "");
  }, [task?.id, task?.notes]);

  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      updateTask({ notes: value });
    }, 800); // Debounce de 800ms
  }, [updateTask]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { localNotes, handleNotesChange };
}

export function TaskDetailSheet({ 
  task, 
  isOpen, 
  onClose, 
  statuses, 
  sales, 
  customers,
  services 
}: TaskDetailSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset title when task changes
  useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
      setIsEditingTitle(false);
    }
  }, [task?.id]);

  const updateTask = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  // Debounced notes to prevent lag
  const { localNotes, handleNotesChange } = useDebouncedNotes(
    task,
    (updates) => updateTask.mutate(updates)
  );

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
      toast.success("Tarefa excluída!");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const duplicateTask = useMutation({
    mutationFn: async () => {
      if (!task || !user) return;
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: `${task.title} (cópia)`,
        status_id: task.status_id,
        priority: task.priority,
        due_date: task.due_date,
        notes: task.notes,
        customer_id: task.customer_id,
        sale_id: task.sale_id,
        service_id: task.service_id,
        estimated_time: task.estimated_time,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa duplicada!");
    },
    onError: () => toast.error("Erro ao duplicar tarefa"),
  });

  const handleFileUpload = async (file: File) => {
    if (!task || !user) return;
    setIsUploading(true);
    try {
      // Use task-based path (shared across users)
      const filePath = `tasks/${task.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("contracts")
        .getPublicUrl(filePath);

      updateTask.mutate({ contract_url: publicUrl, contract_name: file.name } as any);
      toast.success("Arquivo enviado!");
    } catch (error) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!task?.contract_url || !task?.contract_name || !user) return;
    try {
      // Use task-based path (shared across users)
      const filePath = `tasks/${task.id}/${task.contract_name}`;
      await supabase.storage.from("contracts").remove([filePath]);
      updateTask.mutate({ contract_url: null, contract_name: null } as any);
      toast.success("Arquivo excluído!");
    } catch (error) {
      toast.error("Erro ao excluir arquivo");
    }
  };

  if (!task) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="sr-only">Detalhes da Tarefa</SheetTitle>
          <SheetDescription className="sr-only">
            Visualize e edite os detalhes da tarefa
          </SheetDescription>
          {/* Editable Title */}
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <>
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-semibold flex-1"
                  placeholder="Título da tarefa"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateTask.mutate({ title: editedTitle });
                      setIsEditingTitle(false);
                    }
                    if (e.key === 'Escape') {
                      setEditedTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-primary"
                  onClick={() => {
                    updateTask.mutate({ title: editedTitle });
                    setIsEditingTitle(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditedTitle(task.title);
                    setIsEditingTitle(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold flex-1 truncate">{task.title}</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
            {/* Status and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Select
                  value={task.status_id || "none"}
                  onValueChange={(v) => updateTask.mutate({ status_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {task.status ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: task.status.color }}
                          />
                          {task.status.name}
                        </div>
                      ) : (
                        "Sem status"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem status</SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                <Select
                  value={task.priority || "medium"}
                  onValueChange={(v) => updateTask.mutate({ priority: v as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <TaskPriorityBadge priority={task.priority || 'medium'} size="sm" />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: config.color }}
                          />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Prazo</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !task.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {task.due_date 
                      ? format(parseDateOnly(task.due_date), "PPP", { locale: ptBR })
                      : "Definir prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={task.due_date ? parseDateOnly(task.due_date) : undefined}
                    onSelect={(date) => updateTask.mutate({ 
                      due_date: date ? format(date, "yyyy-MM-dd") : null 
                    })}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                  {task.due_date && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full"
                        onClick={() => updateTask.mutate({ due_date: null })}
                      >
                        Remover prazo
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tags</label>
              <TaskTagsManager taskId={task.id} assignedTags={task.tags || []} />
            </div>

            <Separator />

            {/* Checklist */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Checklist</label>
              <TaskChecklist taskId={task.id} items={task.checklists || []} />
            </div>

            <Separator />

            {/* Time Tracker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tempo</label>
              <TaskTimeTracker 
                taskId={task.id} 
                estimatedTime={task.estimated_time} 
                timeSpent={task.time_spent || 0} 
              />
            </div>

            <Separator />

            {/* Links */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-muted-foreground">Vínculos</label>
              
              {/* Customer - Searchable */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="flex-1 justify-between font-normal"
                    >
                      {task.customer_id
                        ? customers.find(c => c.id === task.customer_id)?.name || "Cliente"
                        : "Vincular cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              updateTask.mutate({ customer_id: null });
                              setCustomerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !task.customer_id ? "opacity-100" : "opacity-0")} />
                            Nenhum cliente
                          </CommandItem>
                          {customers.map(customer => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => {
                                updateTask.mutate({ customer_id: customer.id });
                                setCustomerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", task.customer_id === customer.id ? "opacity-100" : "opacity-0")} />
                              {customer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Sale - Searchable */}
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <Popover open={saleOpen} onOpenChange={setSaleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={saleOpen}
                      className="flex-1 justify-between font-normal"
                    >
                      {task.sale_id
                        ? (() => {
                            const sale = sales.find(s => s.id === task.sale_id);
                            return sale ? `${sale.sale_number} - ${sale.customer?.name || "Sem cliente"}` : "Venda";
                          })()
                        : "Vincular venda..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar venda..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma venda encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              updateTask.mutate({ sale_id: null });
                              setSaleOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !task.sale_id ? "opacity-100" : "opacity-0")} />
                            Nenhuma venda
                          </CommandItem>
                          {sales.map(sale => (
                            <CommandItem
                              key={sale.id}
                              value={`${sale.sale_number} ${sale.customer?.name || ""}`}
                              onSelect={() => {
                                updateTask.mutate({ sale_id: sale.id });
                                setSaleOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", task.sale_id === sale.id ? "opacity-100" : "opacity-0")} />
                              {sale.sale_number} - {sale.customer?.name || "Sem cliente"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Contract/Attachment - Drag and Drop */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Anexo</label>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {task.contract_url ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <a
                    href={task.contract_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-primary hover:underline truncate"
                  >
                    {task.contract_name || "Arquivo"}
                  </a>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={task.contract_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={handleDeleteContract}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                    "hover:border-primary hover:bg-primary/5",
                    isUploading && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add("border-primary", "bg-primary/5");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isUploading ? "Enviando..." : "Arraste um arquivo ou clique para selecionar"}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Observações</label>
              <Textarea
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Adicionar observações..."
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => duplicateTask.mutate()}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteTask.mutate()}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
