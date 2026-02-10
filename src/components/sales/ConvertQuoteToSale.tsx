import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShoppingBag, CreditCard } from "lucide-react";
import { format, addMonths } from "date-fns";

interface Quote {
  id: string;
  title: string;
  description: string | null;
  subtotal: number;
  discount: number | null;
  total: number;
  customer_id: string | null;
  notes: string | null;
}

interface Installment {
  number: number;
  amount: number;
  dueDate: string;
  paymentMethod: string;
}

interface ConvertQuoteToSaleProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
};

export function ConvertQuoteToSale({ quote, open, onOpenChange, onSuccess }: ConvertQuoteToSaleProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [notes, setNotes] = useState("");
  
  // Installment management
  const [useInstallments, setUseInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Generate installments when count changes
  useEffect(() => {
    if (useInstallments && installmentCount > 1 && quote) {
      const installmentAmount = quote.total / installmentCount;
      const newInstallments: Installment[] = [];
      for (let i = 0; i < installmentCount; i++) {
        newInstallments.push({
          number: i + 1,
          amount: installmentAmount,
          dueDate: format(addMonths(new Date(), i + 1), "yyyy-MM-dd"),
          paymentMethod: "pix",
        });
      }
      setInstallments(newInstallments);
    } else {
      setInstallments([]);
    }
  }, [useInstallments, installmentCount, quote?.total]);

  const updateInstallment = (index: number, field: keyof Installment, value: string | number) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!user || !quote) throw new Error("Dados inválidos");

      // Generate sale number
      const { data: saleNumber, error: numberError } = await supabase
        .rpc("generate_sale_number", { _user_id: user.id });
      
      if (numberError) throw numberError;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          user_id: user.id,
          quote_id: quote.id,
          customer_id: quote.customer_id,
          sale_number: saleNumber,
          title: quote.title,
          description: quote.description,
          subtotal: quote.subtotal,
          discount: quote.discount || 0,
          total: quote.total,
          payment_method: useInstallments ? "installments" : paymentMethod,
          payment_status: useInstallments ? "pending" : "pending",
          notes: notes || quote.notes,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Copy quote items to sale items
      const { data: quoteItems, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id);

      if (itemsError) throw itemsError;

      if (quoteItems && quoteItems.length > 0) {
        const saleItems = quoteItems.map((item) => ({
          sale_id: sale.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }));

        const { error: insertItemsError } = await supabase
          .from("sale_items")
          .insert(saleItems);

        if (insertItemsError) throw insertItemsError;
      }

      // Update quote status to approved
      await supabase
        .from("quotes")
        .update({ status: "approved" })
        .eq("id", quote.id);

      // Create financial entries
      if (useInstallments && installments.length > 0) {
        for (const inst of installments) {
          await supabase.from("financial_entries").insert({
            user_id: user.id,
            type: "income",
            description: `Venda: ${quote.title} - Parcela ${inst.number}/${installments.length}`,
            amount: inst.amount,
            customer_id: quote.customer_id,
            payment_method: inst.paymentMethod as "pix" | "cash" | "card" | "transfer",
            payment_status: "pending",
            due_date: inst.dueDate,
            installments: installments.length,
            current_installment: inst.number,
            notes: `Referente à venda ${saleNumber} - Parcela ${inst.number} de ${installments.length}`,
          });
        }
      } else {
        // Create single income entry
        await supabase
          .from("financial_entries")
          .insert({
            user_id: user.id,
            type: "income",
            description: `Venda: ${quote.title}`,
            amount: quote.total,
            customer_id: quote.customer_id,
            payment_method: paymentMethod as "pix" | "cash" | "card" | "transfer",
            payment_status: "pending",
            notes: `Referente à venda ${saleNumber}`,
          });
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Orçamento convertido em venda com sucesso!" });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao converter orçamento", variant: "destructive" });
    },
  });

  if (!quote) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Converter em Venda
          </DialogTitle>
          <DialogDescription>
            Confirme a conversão do orçamento "{quote.title}" em uma venda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Valor Total:</span>
              <span className="font-bold text-lg text-green-600">
                {formatCurrency(quote.total)}
              </span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Tipo de Pagamento
              </Label>
              <Select
                value={useInstallments ? "yes" : "no"}
                onValueChange={(v) => setUseInstallments(v === "yes")}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">À vista</SelectItem>
                  <SelectItem value="yes">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!useInstallments && (
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
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
            )}

            {useInstallments && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="24"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 2)}
                  />
                </div>

                {installments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Detalhes das Parcelas</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Parc.</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Forma</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installments.map((inst, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{inst.number}ª</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={inst.amount}
                                onChange={(e) => updateInstallment(index, "amount", parseFloat(e.target.value) || 0)}
                                className="w-[90px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={inst.dueDate}
                                onChange={(e) => updateInstallment(index, "dueDate", e.target.value)}
                                className="w-[140px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={inst.paymentMethod}
                                onValueChange={(v) => updateInstallment(index, "paymentMethod", v)}
                              >
                                <SelectTrigger className="w-[100px]">
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
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais sobre a venda..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingBag className="h-4 w-4 mr-2" />
            )}
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
