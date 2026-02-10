import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import { InlineCustomerDialog } from "@/components/shared/InlineCustomerDialog";
import { EditCustomerDialog } from "@/components/shared/EditCustomerDialog";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Pencil } from "lucide-react";
interface Subscription {
  id: string;
  title: string;
  description: string | null;
  monthly_value: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  payment_day: number | null;
  notes: string | null;
  customer_id: string | null;
}

interface SubscriptionFormDialogProps {
  subscription?: Subscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SubscriptionFormDialog({
  subscription,
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyValue, setMonthlyValue] = useState<number>(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentDay, setPaymentDay] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  
  // Inline customer dialog
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  
  const handleCustomerCreated = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
  };

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

  useEffect(() => {
    if (subscription) {
      setTitle(subscription.title);
      setDescription(subscription.description || "");
      setMonthlyValue(subscription.monthly_value);
      // Ensure date is in YYYY-MM-DD format for the input
      setStartDate(subscription.start_date ? subscription.start_date.split("T")[0] : "");
      setEndDate(subscription.end_date ? subscription.end_date.split("T")[0] : "");
      setPaymentDay(subscription.payment_day || 1);
      setIsActive(subscription.is_active);
      setCustomerId(subscription.customer_id || "");
      setNotes(subscription.notes || "");
    } else {
      resetForm();
    }
  }, [subscription, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMonthlyValue(0);
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setPaymentDay(1);
    setIsActive(true);
    setCustomerId("");
    setNotes("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Use description as title, or customer name, or default text
      const selectedCustomer = customers?.find(c => c.id === customerId);
      const generatedTitle = description || selectedCustomer?.name || "Assinatura";

      const subscriptionData = {
        user_id: user.id,
        customer_id: customerId || null,
        title: generatedTitle,
        description: description || null,
        monthly_value: monthlyValue,
        start_date: startDate,
        end_date: endDate || null,
        payment_day: paymentDay,
        is_active: isActive,
        notes: notes || null,
      };

      if (subscription?.id) {
        const { error } = await supabase
          .from("subscriptions")
          .update(subscriptionData)
          .eq("id", subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subscriptions")
          .insert(subscriptionData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast({ title: subscription ? "Assinatura atualizada!" : "Assinatura criada!" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao salvar assinatura", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {subscription ? "Editar Assinatura" : "Nova Assinatura"}
          </DialogTitle>
          <DialogDescription>
            {subscription ? "Atualize os dados da assinatura" : "Configure uma nova assinatura mensal"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="customer">Cliente</Label>
            <div className="flex gap-2 min-w-0">
              <div className="flex-1 min-w-0 overflow-hidden">
                <CustomerSearchSelect
                  customers={customers}
                  value={customerId}
                  onValueChange={setCustomerId}
                  placeholder="Selecione um cliente"
                  allowEmpty={true}
                />
              </div>
              {customerId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setShowEditCustomerDialog(true)}
                  title="Editar cliente"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setShowCustomerDialog(true)}
                  title="Cadastrar novo cliente"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do serviço mensal..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="monthlyValue">Valor Mensal *</Label>
              <CurrencyInput
                id="monthlyValue"
                value={monthlyValue}
                onChange={setMonthlyValue}
              />
            </div>
          <div className="space-y-2 min-w-0">
            <Label htmlFor="paymentDay">Data para Pagamento</Label>
            <Input
              id="paymentDay"
              value="Último dia útil do mês"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              A data de pagamento é sempre o último dia útil de cada mês
            </p>
          </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="endDate">Data de Término</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="isActive">Assinatura Ativa</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={(!description && !customerId) || saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <InlineCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onCustomerCreated={handleCustomerCreated}
      />
      
      {customerId && (
        <EditCustomerDialog
          customerId={customerId}
          open={showEditCustomerDialog}
          onOpenChange={setShowEditCustomerDialog}
        />
      )}
    </Dialog>
  );
}
