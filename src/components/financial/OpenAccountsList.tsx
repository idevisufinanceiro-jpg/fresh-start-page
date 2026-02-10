import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, startOfDay, isBefore, addMonths, startOfMonth, parseISO, endOfMonth } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Clock,
  MoreVertical, 
  Edit, 
  CheckCircle,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  AlertTriangle,
  Trash2,
  DollarSign,
  ExternalLink,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { PartialPaymentDialog } from "./PartialPaymentDialog";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";

type FinancialEntry = Tables<"financial_entries"> & {
  customers?: { name: string } | null;
  isSubscription?: boolean;
  subscriptionId?: string;
  subscriptionTitle?: string;
};

interface OpenAccountsListProps {
  onEditEntry: (entry: FinancialEntry) => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  open: "Em Aberto",
};

const paymentMethodIcons: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  transfer: <ArrowRightLeft className="h-4 w-4" />,
  open: <Clock className="h-4 w-4" />,
};

export function OpenAccountsList({ onEditEntry }: OpenAccountsListProps) {
  // Realtime updates
  useFinancialRealtime();
  
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [partialPaymentOpen, setPartialPaymentOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const today = startOfDay(new Date());

  const handleEditEntry = (entry: FinancialEntry) => {
    // If entry has sale_id, navigate to sales page to edit the sale
    if (entry.sale_id) {
      navigate(`/sales?edit=${entry.sale_id}`);
    } else if (entry.isSubscription) {
      navigate(`/subscriptions`);
    } else {
      onEditEntry(entry);
    }
  };

  const { data: entries, isLoading } = useQuery({
    queryKey: ["open-accounts"],
    queryFn: async () => {
      // Fetch pending financial entries
      const { data: financialData, error: financialError } = await supabase
        .from("financial_entries")
        .select("*, customers(name)")
        .eq("type", "income")
        .neq("payment_status", "paid")
        .order("due_date", { ascending: true });
      
      if (financialError) throw financialError;

      // Fetch active subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from("subscriptions")
        .select("id, title, monthly_value, start_date, end_date, payment_day, is_active, customer:customers(name)")
        .eq("is_active", true);

      if (subsError) throw subsError;

      // Fetch ALL subscription payments (not just current month)
      const { data: subscriptionPayments, error: subPaymentsError } = await supabase
        .from("subscription_payments")
        .select("id, amount, month, year, payment_status, subscription_id, is_skipped, financial_entry_id");

      if (subPaymentsError) throw subPaymentsError;

      // Build a set of financial_entry_ids that come from subscription payments
      // These should NOT appear in open accounts as virtual subscription entries handle them
      const subscriptionFinancialEntryIds = new Set(
        (subscriptionPayments || [])
          .filter(p => p.financial_entry_id)
          .map(p => p.financial_entry_id)
      );

      // Filter out financial entries that are linked to subscription payments
      const filteredFinancialData = (financialData || []).filter(
        entry => !subscriptionFinancialEntryIds.has(entry.id)
      );

      // Generate pending subscription entries for CURRENT MONTH ONLY
      const subscriptionEntries: FinancialEntry[] = [];
      const now = new Date();
      const currentMonthNum = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      (subscriptions || []).forEach(subscription => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : addMonths(now, 12);
        const monthlyValue = Number(subscription.monthly_value);

        // Only show if subscription is active for current month
        const subscriptionStartMonth = startOfMonth(startDate);
        const currentMonthStart = startOfMonth(now);
        
        // Skip if subscription hasn't started yet or already ended
        if (isBefore(currentMonthStart, subscriptionStartMonth) || isBefore(endDate, currentMonthStart)) {
          return;
        }

        const month = currentMonthNum;
        const year = currentYear;

        // Check if there's already a payment record for this month
        const existingPayment = (subscriptionPayments || []).find(
          p => p.subscription_id === subscription.id && p.month === month && p.year === year
        );

        // Skip if payment was marked as skipped (Não Faturado)
        if (existingPayment?.is_skipped === true) {
          return;
        }

        // Skip if already paid
        if (existingPayment?.payment_status === "paid") {
          return;
        }

        const paymentStatus = existingPayment?.payment_status || "pending";
        
        // Use payment_day if available, otherwise use last day of month
        const paymentDay = subscription.payment_day || 28;
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
        const paymentDate = new Date(year, month - 1, actualPaymentDay);
        
        // Create a virtual entry for the subscription
        subscriptionEntries.push({
          id: existingPayment?.id || `sub-${subscription.id}-${year}-${month}`,
          user_id: "",
          description: `📋 ${subscription.title}`,
          amount: monthlyValue,
          type: "income",
          payment_status: paymentStatus as any,
          payment_method: "open",
          due_date: format(paymentDate, "yyyy-MM-dd"),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          customers: subscription.customer,
          isSubscription: true,
          subscriptionId: subscription.id,
          subscriptionTitle: subscription.title,
          category_id: null,
          customer_id: null,
          notes: null,
          original_amount: null,
          paid_at: null,
          receipt_url: null,
          remaining_amount: null,
          sale_id: null,
          service_id: null,
          current_installment: null,
          installments: null,
        });
      });

      // Combine and sort by due_date
      const allEntries = [...filteredFinancialData, ...subscriptionEntries].sort((a, b) => {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return dateA - dateB;
      });

      return allEntries as FinancialEntry[];
    },
  });

  const partialPaymentMutation = useMutation({
    mutationFn: async ({ 
      id, 
      paidAmount, 
      method, 
      isFullPayment,
      originalEntry 
    }: { 
      id: string; 
      paidAmount: number; 
      method: string; 
      isFullPayment: boolean;
      originalEntry: FinancialEntry;
    }) => {
      const currentRemaining = Number(originalEntry.remaining_amount) || Number(originalEntry.amount);
      const newRemaining = currentRemaining - paidAmount;

      if (isFullPayment || newRemaining <= 0) {
        // Full payment - update to paid
        const { error } = await supabase
          .from("financial_entries")
          .update({ 
            payment_status: "paid",
            payment_method: method as any,
            paid_at: new Date().toISOString(),
            remaining_amount: 0
          })
          .eq("id", id);
        if (error) throw error;

        // Update sale payment status if linked
        if (originalEntry.sale_id) {
          // Check if all entries for this sale are paid
          const { data: saleEntries } = await supabase
            .from("financial_entries")
            .select("payment_status")
            .eq("sale_id", originalEntry.sale_id);
          
          const allPaid = saleEntries?.every(e => e.payment_status === "paid");
          const somePaid = saleEntries?.some(e => e.payment_status === "paid");
          
          await supabase
            .from("sales")
            .update({ 
              payment_status: allPaid ? "paid" : somePaid ? "partial" : "pending"
            })
            .eq("id", originalEntry.sale_id);
        }
      } else {
        // Partial payment - create a new "paid" entry for the paid portion and update remaining
        const { error: updateError } = await supabase
          .from("financial_entries")
          .update({ 
            amount: newRemaining,
            remaining_amount: newRemaining,
            payment_status: "partial"
          })
          .eq("id", id);
        if (updateError) throw updateError;

        // Create a new entry for the paid portion
        const { error: insertError } = await supabase
          .from("financial_entries")
          .insert({
            user_id: originalEntry.user_id,
            description: `${originalEntry.description} (parcial)`,
            amount: paidAmount,
            original_amount: Number(originalEntry.original_amount) || Number(originalEntry.amount),
            remaining_amount: 0,
            type: "income",
            payment_status: "paid",
            payment_method: method as any,
            paid_at: new Date().toISOString(),
            customer_id: originalEntry.customer_id,
            sale_id: originalEntry.sale_id,
            due_date: originalEntry.due_date,
            installments: originalEntry.installments,
            current_installment: originalEntry.current_installment,
          });
        if (insertError) throw insertError;

        // Update sale payment status to partial if linked
        if (originalEntry.sale_id) {
          await supabase
            .from("sales")
            .update({ payment_status: "partial" })
            .eq("id", originalEntry.sale_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      toast({ title: "Pagamento registrado!" });
    },
    onError: () => {
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      toast({ title: "Recebimento excluído!" });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir recebimento", variant: "destructive" });
    },
  });

  const handleDeleteClick = (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteMutation.mutate(entryToDelete);
    }
  };

  const handlePartialPayment = (entry: FinancialEntry) => {
    setSelectedEntry(entry);
    setPartialPaymentOpen(true);
  };

  const handleConfirmPartialPayment = (entryId: string, paidAmount: number, method: string, isFullPayment: boolean) => {
    if (selectedEntry) {
      partialPaymentMutation.mutate({
        id: entryId,
        paidAmount,
        method,
        isFullPayment,
        originalEntry: selectedEntry
      });
    }
  };

  const total = entries?.reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0) || 0;

  const filteredEntries = entries?.filter(entry => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    const descriptionMatch = entry.description.toLowerCase().includes(searchLower);
    const customerMatch = entry.customers?.name?.toLowerCase().includes(searchLower);
    return descriptionMatch || customerMatch;
  });

  const getDueDateStatus = (dueDate: string | null, isSubscription: boolean = false) => {
    if (!dueDate) return { label: "Sem data", className: "bg-muted text-muted-foreground", isOverdue: false, daysUntil: 0 };
    
    const date = new Date(dueDate);
    const daysUntil = differenceInDays(startOfDay(date), today);
    
    // For subscriptions, only consider overdue after the month has passed
    // (i.e., we're now in a new month and the payment wasn't made)
    let isOverdue: boolean;
    if (isSubscription) {
      // Subscription is overdue only if we're past the end of the due date's month
      const dueDateMonth = date.getMonth();
      const dueDateYear = date.getFullYear();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Overdue if we're in a later month/year
      isOverdue = currentYear > dueDateYear || (currentYear === dueDateYear && currentMonth > dueDateMonth);
    } else {
      isOverdue = isBefore(date, today);
    }
    
    if (isOverdue) {
      return { 
        label: isSubscription ? `Mês anterior não pago` : `Vencido há ${Math.abs(daysUntil)} dias`, 
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", 
        isOverdue: true,
        daysUntil 
      };
    } else if (daysUntil === 0) {
      return { 
        label: "Vence hoje", 
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", 
        isOverdue: false,
        daysUntil 
      };
    } else if (daysUntil <= 3) {
      return { 
        label: `Vence em ${daysUntil} dias`, 
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", 
        isOverdue: false,
        daysUntil 
      };
    } else if (daysUntil < 0 && isSubscription) {
      // Subscription payment day passed but still in the same month - show as "no prazo"
      return { 
        label: `Dia ${date.getDate()} deste mês`, 
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", 
        isOverdue: false,
        daysUntil 
      };
    } else {
      return { 
        label: `Vence em ${daysUntil} dias`, 
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", 
        isOverdue: false,
        daysUntil 
      };
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  Contas em Aberto
                </CardTitle>
                <div className="mt-2 text-sm text-muted-foreground">
                  <span>Total a Receber: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredEntries?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-accent" />
              <p>{search ? "Nenhuma conta encontrada" : "Nenhuma conta em aberto"}</p>
              <p className="text-sm">{search ? "Tente outro termo de busca" : "Todas as contas estão pagas!"}</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3 overflow-x-hidden">
                {filteredEntries?.map((entry) => {
                  const status = getDueDateStatus(entry.due_date, entry.isSubscription);
                  const displayAmount = Number(entry.remaining_amount || entry.amount);
                  const originalAmount = Number(entry.original_amount || entry.amount);
                  const isPartial = entry.payment_status === "partial" || displayAmount < originalAmount;
                  
                  return (
                    <div 
                      key={entry.id} 
                      className={cn(
                        "border rounded-lg p-4 space-y-3 overflow-hidden",
                        status.isOverdue && "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {status.isOverdue && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
                            <p className="font-medium text-sm truncate flex-1">{entry.description}</p>
                            {entry.isSubscription && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                Assinatura
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{entry.customers?.name || "-"}</p>
                          {isPartial && !entry.isSubscription && (
                            <Badge variant="outline" className="mt-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Parcial - Original: R$ {originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleEditEntry(entry)}>
                              {entry.isSubscription ? (
                                <>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir Assinatura
                                </>
                              ) : entry.sale_id ? (
                                <>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir Venda
                                </>
                              ) : (
                                <>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => entry.isSubscription 
                                ? navigate(`/subscriptions?pay=${entry.subscriptionId}&month=${entry.due_date}`)
                                : handlePartialPayment(entry)
                              }
                              className="text-accent"
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Dar Baixa
                            </DropdownMenuItem>
                            {!entry.isSubscription && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(entry.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex flex-col gap-1">
                          <Badge className={cn("text-xs", status.className)}>
                            {entry.due_date 
                              ? format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })
                              : "Sem data"
                            }
                          </Badge>
                          <p className="text-xs text-muted-foreground">{status.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-accent">
                            R$ {displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            {paymentMethodIcons[entry.payment_method || "open"]}
                            <span>{paymentMethodLabels[entry.payment_method || "open"]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Forma de Pagamento</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries?.map((entry) => {
                      const status = getDueDateStatus(entry.due_date, entry.isSubscription);
                      const displayAmount = Number(entry.remaining_amount || entry.amount);
                      const originalAmount = Number(entry.original_amount || entry.amount);
                      const isPartial = entry.payment_status === "partial" || displayAmount < originalAmount;

                      return (
                        <TableRow key={entry.id} className={cn(status.isOverdue && "bg-destructive/5")}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {status.isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                              <div>
                                <div className="flex items-center gap-2">
                                  {entry.description}
                                  {entry.isSubscription && (
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                      Assinatura
                                    </Badge>
                                  )}
                                </div>
                                {isPartial && !entry.isSubscription && (
                                  <p className="text-xs text-amber-600">
                                    Original: R$ {originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{entry.customers?.name || "-"}</TableCell>
                          <TableCell className="font-medium text-accent">
                            R$ {displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {paymentMethodIcons[entry.payment_method || "open"]}
                              {paymentMethodLabels[entry.payment_method || "open"]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={status.className}>
                              {entry.due_date 
                                ? format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })
                                : "Sem data"
                              }
                            </Badge>
                            <p className="text-xs mt-1 text-muted-foreground">{status.label}</p>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => handleEditEntry(entry)}>
                                  {entry.isSubscription ? (
                                    <>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Abrir Assinatura
                                    </>
                                  ) : entry.sale_id ? (
                                    <>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Abrir Venda
                                    </>
                                  ) : (
                                    <>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => entry.isSubscription 
                                    ? navigate(`/subscriptions?pay=${entry.subscriptionId}&month=${entry.due_date}`)
                                    : handlePartialPayment(entry)
                                  }
                                  className="text-accent"
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Dar Baixa
                                </DropdownMenuItem>
                                {!entry.isSubscription && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteClick(entry.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Partial Payment Dialog */}
      {selectedEntry && (
        <PartialPaymentDialog
          open={partialPaymentOpen}
          onOpenChange={setPartialPaymentOpen}
          entryId={selectedEntry.id}
          description={selectedEntry.description}
          totalAmount={Number(selectedEntry.original_amount || selectedEntry.amount)}
          remainingAmount={Number(selectedEntry.remaining_amount || selectedEntry.amount)}
          onConfirm={handleConfirmPartialPayment}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este recebimento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
