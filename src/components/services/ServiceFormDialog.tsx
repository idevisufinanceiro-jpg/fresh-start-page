import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Loader2 } from "lucide-react";

type Service = Tables<"services">;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  quoteId?: string | null;
}

const categoryLabels: Record<string, string> = {
  wedding: "Casamento",
  corporate: "Corporativo",
  birthday: "Aniversário",
  graduation: "Formatura",
  baptism: "Batizado",
  other: "Outro",
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  in_progress: "Em Andamento",
  completed: "Concluído",
};

export function ServiceFormDialog({ open, onOpenChange, service, quoteId }: ServiceFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [status, setStatus] = useState<string>("scheduled");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [totalValue, setTotalValue] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(*)")
        .eq("id", quoteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  useEffect(() => {
    if (service) {
      setTitle(service.title);
      setDescription(service.description || "");
      setCustomerId(service.customer_id || "");
      setCategory(service.category || "other");
      setStatus(service.status || "scheduled");
      setStartDate(service.start_date || "");
      setDueDate(service.due_date || "");
      setTotalValue(service.total_value || 0);
      setNotes(service.notes || "");
    } else if (quote) {
      setTitle(quote.title);
      setDescription(quote.description || "");
      setCustomerId(quote.customer_id || "");
      setCategory(quote.category || "other");
      setTotalValue(quote.total || 0);
    } else {
      setTitle("");
      setDescription("");
      setCustomerId("");
      setCategory("other");
      setStatus("scheduled");
      setStartDate("");
      setDueDate("");
      setTotalValue(0);
      setNotes("");
    }
  }, [service, quote, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      const serviceData = {
        user_id: user.id,
        title,
        description: description || null,
        customer_id: customerId || null,
        quote_id: quoteId || service?.quote_id || null,
        category: category as any,
        status: status as any,
        start_date: startDate || null,
        due_date: dueDate || null,
        total_value: totalValue,
        notes: notes || null,
      };

      if (service) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert(serviceData);
        if (error) throw error;

        // Update quote status if converting from quote
        if (quoteId) {
          await supabase
            .from("quotes")
            .update({ status: "approved" })
            .eq("id", quoteId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({
        title: service ? "Serviço atualizado" : "Serviço criado",
        description: service ? "Serviço atualizado com sucesso." : "Serviço criado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error saving service:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o serviço.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {service ? "Editar Serviço" : quoteId ? "Converter Orçamento em Serviço" : "Novo Serviço"}
          </DialogTitle>
          <DialogDescription>
            {service ? "Atualize os dados do serviço" : quoteId ? "Configure o serviço a partir do orçamento" : "Cadastre um novo serviço"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 min-w-0">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do serviço"
              />
            </div>

            <div className="min-w-0">
              <Label htmlFor="customer">Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Label htmlFor="totalValue">Valor Total</Label>
              <CurrencyInput
                id="totalValue"
                value={totalValue}
                onChange={setTotalValue}
              />
            </div>

            <div className="min-w-0">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="min-w-0">
              <Label htmlFor="dueDate">Data de Entrega</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 min-w-0">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do serviço"
                rows={3}
              />
            </div>

            <div className="sm:col-span-2 min-w-0">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações internas"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!title || mutation.isPending} className="w-full sm:w-auto">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {service ? "Salvar" : "Criar Serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
