import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Check, X, Printer, Loader2, CalendarX2, RotateCcw, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generatePaymentReceipt } from "@/lib/generatePaymentReceipt";
import { format, parseISO, isAfter, isBefore, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  title: string;
  monthly_value: number;
  customer_id: string | null;
  customers?: { name: string } | null;
  start_date: string;
  end_date: string | null;
}

interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  year: number;
  month: number;
  amount: number;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  financial_entry_id: string | null;
  is_skipped?: boolean;
  skip_reason?: string | null;
}

const skipReasons = [
  { value: "client_not_paid", label: "Cliente não pagou" },
  { value: "client_unavailable", label: "Cliente indisponível" },
  { value: "service_not_delivered", label: "Serviço não entregue" },
  { value: "other", label: "Outro motivo" },
];

const SKIPPED_LABEL = "Não Faturado";

interface SubscriptionPaymentsDialogProps {
  subscription: Subscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão" },
  { value: "transfer", label: "Transferência" },
];

// Function to calculate the last business day of a month
function getLastBusinessDay(year: number, month: number): Date {
  // Get the last day of the month
  const lastDay = new Date(year, month, 0);
  let day = lastDay.getDate();
  
  // Go backwards until we find a weekday (Monday-Friday)
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    day--;
    lastDay.setDate(day);
  }
  
  return lastDay;
}

export function SubscriptionPaymentsDialog({
  subscription,
  open,
  onOpenChange,
}: SubscriptionPaymentsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [printingMonth, setPrintingMonth] = useState<number | null>(null);
  const [paymentDateMonth, setPaymentDateMonth] = useState<number | null>(null);
  const [paymentDateValue, setPaymentDateValue] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["subscription-payments", subscription?.id, selectedYear],
    queryFn: async () => {
      if (!subscription?.id) return [];
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("subscription_id", subscription.id)
        .eq("year", selectedYear);
      if (error) throw error;
      return data as SubscriptionPayment[];
    },
    enabled: !!subscription?.id && open,
  });

  const paymentMap = payments?.reduce((acc, p) => {
    acc[p.month] = p;
    return acc;
  }, {} as Record<number, SubscriptionPayment>) || {};

  // Calculate which months should be shown based on subscription period
  const visibleMonths = useMemo(() => {
    if (!subscription) return [];
    
    const startDate = parseISO(subscription.start_date);
    const endDate = subscription.end_date ? parseISO(subscription.end_date) : null;
    
    const months: number[] = [];
    
    for (let month = 1; month <= 12; month++) {
      const monthStart = startOfMonth(new Date(selectedYear, month - 1));
      const monthEnd = endOfMonth(new Date(selectedYear, month - 1));
      
      // Check if the month is within the subscription period
      const isAfterStart = !isBefore(monthEnd, startDate);
      const isBeforeEnd = endDate ? !isAfter(monthStart, endDate) : true;
      
      if (isAfterStart && isBeforeEnd) {
        months.push(month);
      }
    }
    
    return months;
  }, [subscription, selectedYear]);

  const markPaidMutation = useMutation({
    mutationFn: async ({ month, method, paidDate }: { month: number; method: string; paidDate?: string }) => {
      if (!subscription || !user) throw new Error("Missing data");

      const existingPayment = paymentMap[month];
      
      // Use provided date or calculate the last business day of the month
      let paymentDate: Date;
      if (paidDate) {
        paymentDate = parseISO(paidDate);
      } else {
        paymentDate = getLastBusinessDay(selectedYear, month);
      }
      const paidAt = paymentDate.toISOString();
      const dueDate = format(paymentDate, "yyyy-MM-dd");

      // Create financial entry
      const { data: financialEntry, error: financialError } = await supabase
        .from("financial_entries")
        .insert({
          user_id: user.id,
          customer_id: subscription.customer_id,
          description: `${subscription.title} - ${monthNames[month - 1]}/${selectedYear}`,
          amount: subscription.monthly_value,
          type: "income",
          payment_method: method as any,
          payment_status: "paid",
          due_date: dueDate,
          paid_at: paidAt,
        })
        .select()
        .single();

      if (financialError) throw financialError;

      if (existingPayment) {
        const { error } = await supabase
          .from("subscription_payments")
          .update({
            payment_status: "paid",
            payment_method: method,
            paid_at: paidAt,
            financial_entry_id: financialEntry.id,
          })
          .eq("id", existingPayment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subscription_payments")
          .insert({
            subscription_id: subscription.id,
            user_id: user.id,
            year: selectedYear,
            month,
            amount: subscription.monthly_value,
            payment_status: "paid",
            payment_method: method,
            paid_at: paidAt,
            financial_entry_id: financialEntry.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      setPaymentDateMonth(null);
      setPaymentDateValue("");
      toast({ title: "Pagamento registrado!" });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    },
  });

  const markPendingMutation = useMutation({
    mutationFn: async (month: number) => {
      if (!subscription || !user) throw new Error("Missing data");

      const existingPayment = paymentMap[month];
      if (!existingPayment) return;

      // Delete financial entry if exists
      if (existingPayment.financial_entry_id) {
        await supabase
          .from("financial_entries")
          .delete()
          .eq("id", existingPayment.financial_entry_id);
      }

      const { error } = await supabase
        .from("subscription_payments")
        .update({
          payment_status: "pending",
          payment_method: null,
          paid_at: null,
          financial_entry_id: null,
        })
        .eq("id", existingPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Pagamento revertido!" });
    },
    onError: () => {
      toast({ title: "Erro ao reverter pagamento", variant: "destructive" });
    },
  });

  // Mutation to skip a month
  const skipMonthMutation = useMutation({
    mutationFn: async ({ month, reason }: { month: number; reason: string }) => {
      if (!subscription || !user) throw new Error("Missing data");

      const existingPayment = paymentMap[month];
      const reasonLabel = skipReasons.find(r => r.value === reason)?.label || reason;

      if (existingPayment) {
        const { error } = await supabase
          .from("subscription_payments")
          .update({
            payment_status: "skipped",
            is_skipped: true,
            skip_reason: reasonLabel,
            payment_method: null,
            paid_at: null,
            financial_entry_id: null,
          })
          .eq("id", existingPayment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subscription_payments")
          .insert({
            subscription_id: subscription.id,
            user_id: user.id,
            year: selectedYear,
            month,
            amount: subscription.monthly_value,
            payment_status: "skipped",
            is_skipped: true,
            skip_reason: reasonLabel,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Mês marcado como não faturado!" });
    },
    onError: () => {
      toast({ title: "Erro ao pular mês", variant: "destructive" });
    },
  });

  // Mutation to revert skipped month to pending
  const revertSkipMutation = useMutation({
    mutationFn: async (month: number) => {
      if (!subscription || !user) throw new Error("Missing data");

      const existingPayment = paymentMap[month];
      if (!existingPayment) return;

      const { error } = await supabase
        .from("subscription_payments")
        .update({
          payment_status: "pending",
          is_skipped: false,
          skip_reason: null,
        })
        .eq("id", existingPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Mês revertido para pendente!" });
    },
    onError: () => {
      toast({ title: "Erro ao reverter mês", variant: "destructive" });
    },
  });

  const handlePrintReceipt = async (month: number) => {
    if (!subscription) return;
    
    setPrintingMonth(month);
    try {
      const payment = paymentMap[month];
      if (!payment || payment.payment_status !== "paid") {
        toast({ title: "Apenas pagamentos confirmados podem gerar recibo", variant: "destructive" });
        return;
      }

      // Fetch customer data
      let customer = null;
      if (subscription.customer_id) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("id", subscription.customer_id)
          .single();
        customer = data;
      }

      // Fetch company settings
      const settings = await fetchSharedCompanySettings("*");

      // Generate a numeric receipt number from subscription id and month
      const receiptNum = parseInt(subscription.id.slice(0, 8).replace(/[^0-9]/g, '').slice(0, 6) || '1', 10) + month;

      await generatePaymentReceipt({
        receiptNumber: receiptNum,
        customerName: customer?.name || "Cliente",
        customerCpfCnpj: customer?.cpf_cnpj || "",
        customerAddress: customer?.address || "",
        customerCity: customer?.city || "",
        customerState: customer?.state || "",
        customerCep: customer?.cep || "",
        description: `${subscription.title} - ${monthNames[month - 1]}/${selectedYear}`,
        amount: subscription.monthly_value,
        paymentMethod: payment.payment_method || "pix",
        paidAt: payment.paid_at || new Date().toISOString(),
        companyName: settings?.company_name || "",
        companyPhone: settings?.phone || "",
        companyEmail: settings?.email || "",
        companyAddress: settings?.address || "",
        companyCnpj: settings?.cnpj_cpf || "",
        logoUrl: settings?.logo_url || "",
        receiptLogoUrl: (settings as any)?.receipt_logo_url || "",
        receivedByName: user?.email || "Sistema",
      });

      toast({ title: "Recibo gerado com sucesso!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar recibo", variant: "destructive" });
    } finally {
      setPrintingMonth(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const paidCount = visibleMonths.filter(m => paymentMap[m]?.payment_status === "paid").length;
  const skippedCount = visibleMonths.filter(m => paymentMap[m]?.is_skipped === true).length;
  const paidTotal = paidCount * (subscription?.monthly_value || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pagamentos - {subscription?.title}</span>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogTitle>
          <DialogDescription>
            Gerencie os pagamentos mensais desta assinatura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Pagos em {selectedYear}</p>
              <p className="text-2xl font-bold">{paidCount} de {visibleMonths.length} meses</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(paidTotal)}</p>
            </div>
          </div>

          {/* Months Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : visibleMonths.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum mês disponível para este ano.</p>
              <p className="text-sm">A assinatura não está ativa neste período.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleMonths.map((month) => {
                const payment = paymentMap[month];
                const isPaid = payment?.payment_status === "paid";
                const isSkipped = payment?.is_skipped === true;
                const paidDate = payment?.paid_at ? format(parseISO(payment.paid_at), "dd/MM/yyyy", { locale: ptBR }) : null;

                return (
                  <div
                    key={month}
                    className={`p-4 rounded-lg border ${
                      isPaid 
                        ? "bg-accent/10 border-accent/30" 
                        : isSkipped 
                          ? "bg-muted/50 border-muted-foreground/30" 
                          : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{monthNames[month - 1]}</span>
                      {isPaid ? (
                        <Badge className="bg-accent/20 text-accent text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Pago
                        </Badge>
                      ) : isSkipped ? (
                        <Badge variant="secondary" className="text-xs">
                          <CalendarX2 className="h-3 w-3 mr-1" />
                          {SKIPPED_LABEL}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm font-semibold mb-1 ${isSkipped ? "text-muted-foreground line-through" : ""}`}>
                      {formatCurrency(subscription?.monthly_value || 0)}
                    </p>
                    {isPaid && paidDate && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Pago em: {paidDate}
                      </p>
                    )}
                    {isSkipped && payment?.skip_reason && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {payment.skip_reason}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {isPaid ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handlePrintReceipt(month)}
                            disabled={printingMonth === month}
                          >
                            {printingMonth === month ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Printer className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => markPendingMutation.mutate(month)}
                            disabled={markPendingMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : isSkipped ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => revertSkipMutation.mutate(month)}
                          disabled={revertSkipMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reverter
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-1 w-full">
                            <Select
                              onValueChange={(method) => {
                                if (paymentDateMonth === month && paymentDateValue) {
                                  markPaidMutation.mutate({ month, method, paidDate: paymentDateValue });
                                } else {
                                  markPaidMutation.mutate({ month, method });
                                }
                              }}
                              disabled={markPaidMutation.isPending}
                            >
                              <SelectTrigger className="flex-1 h-8 text-xs">
                                <SelectValue placeholder="Pagar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentMethods.map((method) => (
                                  <SelectItem key={method.value} value={method.value}>
                                    {method.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  disabled={skipMonthMutation.isPending}
                                  title="Não faturar este mês"
                                >
                                  <CalendarX2 className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                {skipReasons.map((reason) => (
                                  <DropdownMenuItem
                                    key={reason.value}
                                    onClick={() => skipMonthMutation.mutate({ month, reason: reason.value })}
                                  >
                                    {reason.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                            <Input
                              type="date"
                              className="h-7 text-xs flex-1"
                              value={paymentDateMonth === month ? paymentDateValue : ""}
                              onChange={(e) => {
                                setPaymentDateMonth(month);
                                setPaymentDateValue(e.target.value);
                              }}
                              placeholder="Data pgto"
                            />
                          </div>
                          {paymentDateMonth === month && paymentDateValue && (
                            <p className="text-xs text-muted-foreground">
                              Pagamento será registrado em {format(parseISO(paymentDateValue), "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
