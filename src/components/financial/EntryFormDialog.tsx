import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
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

type FinancialEntry = Tables<"financial_entries">;

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinancialEntry | null;
  type: "income" | "expense";
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  open: "Em Aberto",
};

const paymentStatusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  partial: "Parcial",
};

export function EntryFormDialog({ open, onOpenChange, entry, type }: EntryFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState("1");

  // Reset form when dialog opens or entry changes
  useEffect(() => {
    if (open) {
      setDescription(entry?.description || "");
      setAmount(entry?.amount || 0);
      setPaymentMethod(entry?.payment_method || "pix");
      setPaymentStatus(entry?.payment_status || "pending");
      setDueDate(entry?.due_date || "");
      setCategoryId(entry?.category_id || "");
      setCustomerId(entry?.customer_id || "");
      setNotes(entry?.notes || "");
      setInstallments(entry?.installments?.toString() || "1");
    }
  }, [open, entry]);

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: type === "expense",
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: type === "income",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const entryData = {
        user_id: user.id,
        type: type as "income" | "expense",
        description,
        amount: amount,
        payment_method: paymentMethod as "pix" | "cash" | "card" | "transfer",
        payment_status: paymentStatus as "paid" | "pending" | "partial",
        due_date: dueDate || null,
        category_id: type === "expense" && categoryId ? categoryId : null,
        customer_id: type === "income" && customerId ? customerId : null,
        notes: notes || null,
        installments: parseInt(installments) || 1,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      };

      if (entry?.id) {
        const { error } = await supabase
          .from("financial_entries")
          .update(entryData)
          .eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_entries")
          .insert(entryData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: entry ? "Lançamento atualizado!" : "Lançamento criado!" });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao salvar lançamento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entry?.id) return;
      const { error } = await supabase
        .from("financial_entries")
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Lançamento excluído!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir lançamento", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {entry ? "Editar" : "Nova"} {type === "income" ? "Receita" : "Despesa"}
          </DialogTitle>
          <DialogDescription>
            {entry ? "Atualize os dados do lançamento" : `Registre uma nova ${type === "income" ? "receita" : "despesa"}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do lançamento"
            />
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="amount">Valor *</Label>
              <CurrencyInput
                id="amount"
                value={amount}
                onChange={setAmount}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="paymentStatus">Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "expense" && (
            <div className="space-y-2 min-w-0">
              <Label htmlFor="category">Categoria</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color || "#6366f1" }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "income" && (
            <div className="space-y-2 min-w-0">
              <Label htmlFor="customer">Cliente</Label>
              <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 min-w-0">
            <Label htmlFor="installments">Parcelas</Label>
            <Input
              id="installments"
              type="number"
              min="1"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações..."
              rows={2}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            {entry && (
              <Button 
                variant="destructive" 
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="w-full sm:w-auto"
              >
                Excluir
              </Button>
            )}
            <Button 
              className="sm:ml-auto bg-gradient-primary w-full sm:w-auto"
              onClick={() => saveMutation.mutate()}
              disabled={!description || !amount || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
