import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

// Formata Date para string compatível com input datetime-local (YYYY-MM-DDTHH:MM) no timezone LOCAL
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Formata Date para string de data apenas (YYYY-MM-DD) no timezone LOCAL
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
}

const colorOptions = [
  { value: "#6366f1", label: "Roxo" },
  { value: "#10b981", label: "Verde" },
  { value: "#f59e0b", label: "Amarelo" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#14b8a6", label: "Turquesa" },
];

export function EventFormDialog({ open, onOpenChange, event, selectedDate }: EventFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState("#6366f1");
  const [saleId, setSaleId] = useState("");

  // Reset form when dialog opens or event changes
  useEffect(() => {
    if (open) {
      if (event) {
        // Converter horário UTC do banco para horário LOCAL para exibir no form
        setTitle(event.title || "");
        setDescription(event.description || "");
        setStartTime(event.start_time ? formatDateTimeLocal(new Date(event.start_time)) : "");
        setEndTime(event.end_time ? formatDateTimeLocal(new Date(event.end_time)) : "");
        setAllDay(event.all_day || false);
        setColor(event.color || "#6366f1");
        setSaleId(event.sale_id || "");
      } else {
        // Novo evento - usar data selecionada no timezone LOCAL
        setTitle("");
        setDescription("");
        if (selectedDate) {
          const startDate = new Date(selectedDate);
          startDate.setHours(9, 0, 0, 0);
          setStartTime(formatDateTimeLocal(startDate));
          
          const endDate = new Date(selectedDate);
          endDate.setHours(10, 0, 0, 0);
          setEndTime(formatDateTimeLocal(endDate));
        } else {
          setStartTime("");
          setEndTime("");
        }
        setAllDay(false);
        setColor("#6366f1");
        setSaleId("");
      }
    }
  }, [open, event, selectedDate]);

  const { data: sales } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, title")
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Converter string local para ISO (UTC) para salvar no banco
      const eventData = {
        user_id: user.id,
        title,
        description: description || null,
        start_time: startTime ? new Date(startTime).toISOString() : null,
        end_time: endTime ? new Date(endTime).toISOString() : null,
        all_day: allDay,
        color,
        sale_id: saleId || null,
      };

      if (event?.id) {
        const { error } = await supabase
          .from("calendar_events")
          .update(eventData)
          .eq("id", event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .insert(eventData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["sales-calendar"] });
      toast({ title: event ? "Evento atualizado!" : "Evento criado!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar evento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!event?.id) return;
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["sales-calendar"] });
      toast({ title: "Evento excluído!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir evento", variant: "destructive" });
    },
  });

  // Format time from datetime string
  const formatTimeDisplay = (dateTimeStr: string) => {
    if (!dateTimeStr) return "";
    const time = dateTimeStr.split("T")[1];
    return time ? time.slice(0, 5) : "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? "Editar Reunião" : "Nova Reunião"}</DialogTitle>
          <DialogDescription>
            {event ? "Atualize os dados da reunião" : "Agende uma nova reunião no calendário"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome do evento"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(checked as boolean)}
            />
            <Label htmlFor="allDay">Dia inteiro</Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data *</Label>
              <Input
                id="startDate"
                type="date"
                value={startTime.slice(0, 10)}
                onChange={(e) => {
                  const time = startTime.split("T")[1] || "09:00";
                  setStartTime(`${e.target.value}T${time}`);
                }}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="startTimeOnly">Horário</Label>
                <Input
                  id="startTimeOnly"
                  type="time"
                  value={formatTimeDisplay(startTime)}
                  onChange={(e) => {
                    const date = startTime.slice(0, 10);
                    setStartTime(`${date}T${e.target.value}`);
                  }}
                />
              </div>
            )}
          </div>
          {!allDay && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Término</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endTime ? endTime.slice(0, 10) : ""}
                  onChange={(e) => {
                    const time = endTime ? endTime.split("T")[1] || "10:00" : "10:00";
                    setEndTime(`${e.target.value}T${time}`);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTimeOnly">Horário Término</Label>
                <Input
                  id="endTimeOnly"
                  type="time"
                  value={formatTimeDisplay(endTime)}
                  onChange={(e) => {
                    const date = endTime ? endTime.slice(0, 10) : startTime.slice(0, 10);
                    setEndTime(`${date}T${e.target.value}`);
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: color }}
                      />
                      {colorOptions.find(c => c.value === color)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: option.value }}
                        />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale">Vincular a Venda</Label>
              <Select value={saleId || "none"} onValueChange={(value) => setSaleId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {sales?.map((sale) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      {sale.sale_number} - {sale.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do evento..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            {event && (
              <Button 
                variant="destructive" 
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Excluir
              </Button>
            )}
            <Button 
              className="ml-auto bg-gradient-primary"
              onClick={() => saveMutation.mutate()}
              disabled={!title || !startTime || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
