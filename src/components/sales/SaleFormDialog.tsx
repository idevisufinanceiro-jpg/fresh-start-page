import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Package, UserPlus, CalendarDays, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, addMonths } from "date-fns";
import { ServiceItemSelector, ItemForm } from "@/components/shared/ServiceItemSelector";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import { InlineCustomerDialog } from "@/components/shared/InlineCustomerDialog";
import { EditCustomerDialog } from "@/components/shared/EditCustomerDialog";

interface Installment {
  number: number;
  amount: number;
  dueDate: string;
  paymentMethod: string;
}

interface Sale {
  id: string;
  sale_number: string;
  title: string;
  description: string | null;
  subtotal: number;
  discount: number | null;
  total: number;
  payment_method: string | null;
  payment_status: string;
  notes: string | null;
  customer_id: string | null;
  sold_at: string;
}

interface SaleFormDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  open: "Em Aberto",
};

export function SaleFormDialog({ sale, open, onOpenChange, onSuccess }: SaleFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentMethod, setPaymentMethod] = useState("open");
  const [paymentDate, setPaymentDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemForm[]>([]);
  
  // Installment management
  const [useInstallments, setUseInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [installmentsInitialized, setInstallmentsInitialized] = useState(false);

  // Inline customer dialog
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  
  // Event options
  const [isEvent, setIsEvent] = useState(false);
  const [eventDate, setEventDate] = useState("");
  
  const handleCustomerCreated = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
  };

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
    enabled: !!user && open,
  });

  const { data: saleItems } = useQuery({
    queryKey: ["sale-items", sale?.id],
    queryFn: async () => {
      if (!sale?.id) return [];
      const { data, error } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!sale?.id && open,
  });

  const { data: saleFinancialEntry } = useQuery({
    queryKey: ["sale-financial-entry", sale?.id],
    queryFn: async () => {
      if (!sale?.id) return null;
      const { data, error } = await supabase
        .from("financial_entries")
        .select("due_date, paid_at, payment_status")
        .eq("sale_id", sale.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sale?.id && open,
  });

  useEffect(() => {
    if (sale) {
      setDescription(sale.description || "");
      setCustomerId(sale.customer_id || "");
      setPaymentStatus(sale.payment_status || "pending");
      setPaymentMethod((sale as any).payment_method || "pix");

      const saleAny = sale as any;
      const paidAt = saleAny.paid_at as string | undefined;
      setPaymentDate(paidAt ? paidAt.slice(0, 10) : "");

      setDiscount(sale.discount || 0);
      setNotes(sale.notes || "");
      setDeliveryDate((sale as any).delivery_date || "");
      setIsEvent((sale as any).is_event || false);
      setEventDate((sale as any).event_date || "");
      
      // Load installment data
      if (saleAny.installment_count && saleAny.installment_count > 1) {
        setUseInstallments(true);
        setInstallmentCount(saleAny.installment_count);
        if (saleAny.installments_data && Array.isArray(saleAny.installments_data)) {
          setInstallments(saleAny.installments_data);
          setInstallmentsInitialized(true);
        } else {
          setInstallments([]);
          setInstallmentsInitialized(false);
        }
      } else {
        setUseInstallments(false);
        setInstallmentCount(1);
        setInstallments([]);
        setInstallmentsInitialized(false);
      }
    } else {
      setDescription("");
      setCustomerId("");
      setPaymentStatus("pending");
      setPaymentMethod("open");
      setPaymentDate(format(new Date(), "yyyy-MM-dd")); // Default to today's date
      setDiscount(0);
      setNotes("");
      setDeliveryDate("");
      setIsEvent(false);
      setEventDate("");
      setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
      setUseInstallments(false);
      setInstallmentCount(1);
      setInstallments([]);
      setInstallmentsInitialized(false);
    }
  }, [sale, open]);

  useEffect(() => {
    // When editing a non-installment sale, use the linked financial entry date as fallback
    if (!open || !sale || useInstallments) return;
    if (paymentDate) return;

    const fallback =
      (saleFinancialEntry?.paid_at ? String(saleFinancialEntry.paid_at).slice(0, 10) : "") ||
      (saleFinancialEntry?.due_date ? String(saleFinancialEntry.due_date).slice(0, 10) : "") ||
      (sale.sold_at ? String(sale.sold_at).slice(0, 10) : "");

    if (fallback) setPaymentDate(fallback);
  }, [open, sale, useInstallments, saleFinancialEntry, paymentDate]);

  useEffect(() => {
    if (saleItems && saleItems.length > 0) {
      setItems(saleItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.total),
      })));
    }
  }, [saleItems]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  // Generate installments when count changes
  useEffect(() => {
    if (useInstallments && installmentCount > 1 && total > 0) {
      // IMPORTANT: don't overwrite installments loaded from an existing sale
      if (installmentsInitialized) return;

      const installmentAmount = total / installmentCount;
      const newInstallments: Installment[] = [];

      // First installment: same month the sale is created (today). Next: following months.
      for (let i = 0; i < installmentCount; i++) {
        newInstallments.push({
          number: i + 1,
          amount: installmentAmount,
          dueDate: format(addMonths(new Date(), i), "yyyy-MM-dd"),
          paymentMethod: "open",
        });
      }

      setInstallments(newInstallments);
      setInstallmentsInitialized(true);
    } else if (!useInstallments || installmentCount <= 1) {
      setInstallments([]);
      setInstallmentsInitialized(false);
    }
  }, [useInstallments, installmentCount, total, installmentsInitialized]);

  const updateInstallment = (index: number, field: keyof Installment, value: string | number) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    
    // When first installment amount changes, distribute remaining among other installments
    if (index === 0 && field === "amount" && installments.length > 1) {
      const firstAmount = typeof value === "number" ? value : parseFloat(value as string) || 0;
      const remainingAmount = Math.max(0, total - firstAmount);
      const otherInstallmentsCount = installments.length - 1;
      const amountPerInstallment = remainingAmount / otherInstallmentsCount;
      
      // Update all other installments with the distributed amount
      for (let i = 1; i < updated.length; i++) {
        updated[i] = { ...updated[i], amount: amountPerInstallment };
      }
    }
    
    setInstallments(updated);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      const selectedCustomer = customers?.find(c => c.id === customerId);
      const autoTitle = selectedCustomer?.name || "Venda";

      const saleData = {
        user_id: user.id,
        title: autoTitle,
        description: description || null,
        customer_id: customerId || null,
        subtotal,
        discount: discount,
        total,
        payment_status: paymentStatus,
        payment_method: useInstallments ? "installments" : paymentMethod,
        notes: notes || null,
        delivery_date: deliveryDate || null,
        is_event: isEvent,
        event_date: isEvent && eventDate ? eventDate : null,
        installment_count: useInstallments ? installmentCount : 1,
        installments_data: useInstallments && installments.length > 0 ? JSON.parse(JSON.stringify(installments)) : null,
        paid_at: paymentStatus === "paid" && paymentDate ? `${paymentDate}T00:00:00` : null,
      };

      let saleId = sale?.id;

      if (sale?.id) {
        const { error } = await supabase
          .from("sales")
          .update(saleData)
          .eq("id", sale.id);
        if (error) throw error;

        await supabase.from("sale_items").delete().eq("sale_id", sale.id);
      } else {
        const { data: saleNumber, error: numberError } = await supabase
          .rpc("generate_sale_number", { _user_id: user.id });
        if (numberError) throw numberError;

        const { data: newSale, error } = await supabase
          .from("sales")
          .insert({ ...saleData, sale_number: saleNumber })
          .select()
          .single();
        if (error) throw error;
        saleId = newSale.id;
      }

      // Insert items
      const itemsToInsert = items.filter(i => i.description).map(item => ({
        sale_id: saleId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("sale_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      // Delete existing financial entries for this specific sale
      if (sale?.id) {
        await supabase
          .from("financial_entries")
          .delete()
          .eq("sale_id", sale.id);
      }

      // Create financial entries based on payment type
      if (useInstallments && installments.length > 0) {
        // Create financial entries for each installment with synced data
        for (const inst of installments) {
          // Payment method that is not "open" means it's already paid
          const isInstPaid = inst.paymentMethod !== "open";
          const today = new Date().toISOString().split("T")[0];
          
          await supabase.from("financial_entries").insert({
            user_id: user.id,
            type: "income",
            description: `Venda: ${autoTitle} - Parcela ${inst.number}/${installments.length}`,
            amount: inst.amount,
            original_amount: inst.amount,
            remaining_amount: isInstPaid ? 0 : inst.amount,
            customer_id: customerId || null,
            payment_method: inst.paymentMethod as "pix" | "cash" | "card" | "transfer" | "open",
            payment_status: isInstPaid ? "paid" : "pending",
            due_date: inst.dueDate,
            paid_at: isInstPaid ? `${today}T00:00:00` : null,
            installments: installments.length,
            current_installment: inst.number,
            notes: `Referente à venda ${saleId}`,
            sale_id: saleId,
          });
        }
      } else {
        // Single payment - payment method that is not "open" means it's already paid
        const isPaid = paymentMethod !== "open";
        const today = new Date().toISOString().split("T")[0];
        
        await supabase.from("financial_entries").insert({
          user_id: user.id,
          type: "income",
          description: `Venda: ${autoTitle}`,
          amount: total,
          original_amount: total,
          remaining_amount: isPaid ? 0 : total,
          customer_id: customerId || null,
          payment_method: paymentMethod as "pix" | "cash" | "card" | "transfer" | "open",
          payment_status: isPaid ? "paid" : "pending",
          due_date: paymentDate || null,
          paid_at: isPaid ? `${today}T00:00:00` : null,
          notes: `Referente à venda ${saleId}`,
          sale_id: saleId,
        });
      }

      // Delete existing calendar events for this sale
      if (saleId) {
        await supabase
          .from("calendar_events")
          .delete()
          .eq("sale_id", saleId);
      }

      // Create calendar event for delivery date
      if (deliveryDate && saleId) {
        await supabase.from("calendar_events").insert({
          user_id: user.id,
          sale_id: saleId,
          title: `Entrega: ${autoTitle}`,
          description: `Prazo de entrega do projeto`,
          start_time: `${deliveryDate}T09:00:00`,
          all_day: true,
          color: "#ff005c",
        });
      }

      // Create calendar event for event date
      if (isEvent && eventDate && saleId) {
        await supabase.from("calendar_events").insert({
          user_id: user.id,
          sale_id: saleId,
          title: `Evento: ${autoTitle}`,
          description: `Evento agendado`,
          start_time: `${eventDate}T09:00:00`,
          all_day: true,
          color: "#8b5cf6",
        });
      }

      return saleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      toast({ title: sale ? "Venda atualizada!" : "Venda criada!" });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao salvar venda", variant: "destructive" });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{sale ? "Editar Venda" : "Nova Venda"}</DialogTitle>
          <DialogDescription className="text-sm">
            {sale ? `Editando venda ${sale.sale_number}` : "Preencha os dados da venda"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-4 overflow-hidden">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="customer">Cliente *</Label>
              <div className="flex gap-2 min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <CustomerSearchSelect
                    customers={customers}
                    value={customerId}
                    onValueChange={setCustomerId}
                    placeholder="Selecione um cliente"
                    allowEmpty={true}
                    emptyLabel="Sem cliente"
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="deliveryDate">Prazo de Entrega</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da venda"
              rows={2}
            />
          </div>

          {/* Items with Service Selector */}
          <div className="space-y-2 overflow-hidden">
            <ServiceItemSelector items={items} onItemsChange={setItems} />
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg">
            <div className="min-w-0">
              <Label className="text-sm">Subtotal</Label>
              <p className="text-base sm:text-lg font-semibold truncate">{formatCurrency(subtotal)}</p>
            </div>
            <div className="space-y-1 min-w-0">
              <Label htmlFor="discount" className="text-sm">Desconto</Label>
              <CurrencyInput
                id="discount"
                value={discount}
                onChange={setDiscount}
              />
            </div>
            <div className="min-w-0">
              <Label className="text-sm">Total</Label>
              <p className="text-lg sm:text-xl font-bold text-accent truncate">{formatCurrency(total)}</p>
            </div>
          </div>

          {/* Event Options */}
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="isEvent" className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>Esta venda é um evento?</span>
              </Label>
              <Switch
                id="isEvent"
                checked={isEvent}
                onCheckedChange={setIsEvent}
              />
            </div>

            {isEvent && (
              <div className="space-y-2">
                <Label htmlFor="eventDate">Data do Evento</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Payment Options */}
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>Pagamento</span>
              </Label>
              <Select
                value={useInstallments ? "yes" : "no"}
                onValueChange={(v) => {
                  const nextUseInstallments = v === "yes";
                  setUseInstallments(nextUseInstallments);
                  setInstallmentsInitialized(false);

                  if (nextUseInstallments) {
                    setInstallmentCount((prev) => (prev < 2 ? 2 : prev));
                  } else {
                    setInstallmentCount(1);
                    setInstallments([]);
                  }
                }}
              >
                <SelectTrigger className="w-[100px] sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">À vista</SelectItem>
                  <SelectItem value="yes">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {useInstallments && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="24"
                    value={installmentCount}
                    onChange={(e) => {
                      setInstallmentsInitialized(false);
                      setInstallmentCount(parseInt(e.target.value) || 2);
                    }}
                  />
                </div>

                {installments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Detalhes das Parcelas</Label>
                    {/* Mobile: Cards layout */}
                    <div className="md:hidden space-y-3">
                      {installments.map((inst, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-primary">{inst.number}ª Parcela</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Valor</Label>
                              <CurrencyInput
                                value={inst.amount}
                                onChange={(value) => updateInstallment(index, "amount", value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Vencimento</Label>
                              <Input
                                type="date"
                                value={inst.dueDate}
                                onChange={(e) => updateInstallment(index, "dueDate", e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Forma de Pagamento</Label>
                            <Select
                              value={inst.paymentMethod}
                              onValueChange={(v) => updateInstallment(index, "paymentMethod", v)}
                            >
                              <SelectTrigger className="h-9">
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
                        </div>
                      ))}
                    </div>
                    {/* Desktop: Table layout */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Parcela</TableHead>
                            <TableHead className="w-[120px]">Valor</TableHead>
                            <TableHead className="w-[140px]">Vencimento</TableHead>
                            <TableHead className="w-[150px]">Forma de Pagamento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {installments.map((inst, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{inst.number}ª</TableCell>
                              <TableCell>
                                <CurrencyInput
                                  value={inst.amount}
                                  onChange={(value) => updateInstallment(index, "amount", value)}
                                  className="w-[120px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={inst.dueDate}
                                  onChange={(e) => updateInstallment(index, "dueDate", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={inst.paymentMethod}
                                  onValueChange={(v) => updateInstallment(index, "paymentMethod", v)}
                                >
                                  <SelectTrigger className="w-[130px]">
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
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!useInstallments && (
              <>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(value) => {
                      setPaymentMethod(value);
                      // Se for PIX, cartão, dinheiro ou transferência = já está pago
                      // Se for "em aberto" = pendente
                      if (value === "open") {
                        setPaymentStatus("pending");
                      } else {
                        setPaymentStatus("paid");
                      }
                    }}
                  >
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
                {/* Quando for "Em Aberto" o status é automaticamente Pendente */}
                {paymentMethod === "open" && (
                  <div className="space-y-2">
                    <Label>Status do Pagamento</Label>
                    <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-warning">
                      <span className="text-sm font-medium">Pendente</span>
                    </div>
                  </div>
                )}
                {/* Mostrar status como badge informativo quando não for "Em Aberto" */}
                {paymentMethod !== "open" && (
                  <div className="space-y-2">
                    <Label>Status do Pagamento</Label>
                    <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                      <span className="text-sm text-accent font-medium">Pago</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">{paymentMethod === "open" ? "Data de Vencimento" : "Data do Pagamento"}</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a venda"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!customerId || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {sale ? "Atualizar" : "Criar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Inline Customer Dialog */}
      <InlineCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onCustomerCreated={handleCustomerCreated}
      />
      
      {/* Edit Customer Dialog */}
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
