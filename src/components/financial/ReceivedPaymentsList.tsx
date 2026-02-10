import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  CheckCircle2, 
  MoreVertical, 
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  Printer,
  Undo2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, startOfYear, endOfYear, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { generatePaymentReceipt } from "@/lib/generatePaymentReceipt";

const paymentMethodIcons: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  transfer: <ArrowRightLeft className="h-4 w-4" />,
  open: <CheckCircle2 className="h-4 w-4" />,
};

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  transfer: "Transferência",
  open: "Em Aberto",
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function ReceivedPaymentsList() {
  // Realtime updates
  useFinancialRealtime();
  
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [entryToReverse, setEntryToReverse] = useState<any>(null);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["received-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          *,
          customers (name)
        `)
        .eq("type", "income")
        .eq("payment_status", "paid")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*")
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
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      toast({ title: "Recebimento excluído!" });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir recebimento", variant: "destructive" });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (entry: any) => {
      // Check if this entry was a partial payment (has sale_id and description contains "parcial")
      const isPartialPayment = entry.description?.includes("(parcial)");
      
      if (isPartialPayment && entry.sale_id) {
        // Find the original open account entry for this sale
        const { data: originalEntry, error: findError } = await supabase
          .from("financial_entries")
          .select("*")
          .eq("sale_id", entry.sale_id)
          .eq("type", "income")
          .neq("payment_status", "paid")
          .maybeSingle();
        
        if (findError) throw findError;
        
        if (originalEntry) {
          // Add the reversed amount back to the original entry
          const newAmount = Number(originalEntry.amount) + Number(entry.amount);
          const { error: updateError } = await supabase
            .from("financial_entries")
            .update({ 
              amount: newAmount,
              remaining_amount: newAmount,
              payment_status: "pending"
            })
            .eq("id", originalEntry.id);
          if (updateError) throw updateError;
        } else {
          // No open entry found, create one by reverting this entry
          const { error: updateError } = await supabase
            .from("financial_entries")
            .update({ 
              payment_status: "pending",
              payment_method: "open",
              paid_at: null,
              remaining_amount: entry.amount,
              description: entry.description.replace(" (parcial)", "")
            })
            .eq("id", entry.id);
          if (updateError) throw updateError;

          // Update sale status
          if (entry.sale_id) {
            await supabase
              .from("sales")
              .update({ payment_status: "pending" })
              .eq("id", entry.sale_id);
          }
          return; // Don't delete, we converted it
        }
        
        // Delete the partial payment entry
        const { error: deleteError } = await supabase
          .from("financial_entries")
          .delete()
          .eq("id", entry.id);
        if (deleteError) throw deleteError;

        // Update sale status to reflect partial payments
        if (entry.sale_id) {
          const { data: remainingEntries } = await supabase
            .from("financial_entries")
            .select("payment_status")
            .eq("sale_id", entry.sale_id);
          
          const hasPaid = remainingEntries?.some(e => e.payment_status === "paid");
          const allPending = remainingEntries?.every(e => e.payment_status === "pending");
          
          await supabase
            .from("sales")
            .update({ 
              payment_status: allPending ? "pending" : hasPaid ? "partial" : "pending"
            })
            .eq("id", entry.sale_id);
        }
      } else {
        // Regular full payment - just revert to pending
        const { error } = await supabase
          .from("financial_entries")
          .update({ 
            payment_status: "pending",
            payment_method: "open",
            paid_at: null,
            remaining_amount: entry.original_amount || entry.amount
          })
          .eq("id", entry.id);
        if (error) throw error;

        // Update sale status
        if (entry.sale_id) {
          // Check if all entries for this sale are now pending
          const { data: saleEntries } = await supabase
            .from("financial_entries")
            .select("payment_status")
            .eq("sale_id", entry.sale_id);
          
          const allPending = saleEntries?.every(e => e.payment_status === "pending" || e.payment_status === "partial");
          const somePaid = saleEntries?.some(e => e.payment_status === "paid");
          
          await supabase
            .from("sales")
            .update({ 
              payment_status: allPending && !somePaid ? "pending" : "partial"
            })
            .eq("id", entry.sale_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Pagamento estornado! Voltou para contas em aberto." });
      setReverseDialogOpen(false);
      setEntryToReverse(null);
    },
    onError: () => {
      toast({ title: "Erro ao estornar pagamento", variant: "destructive" });
    },
  });

  const handleDeleteClick = (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleReverseClick = (entry: any) => {
    setEntryToReverse(entry);
    setReverseDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteMutation.mutate(entryToDelete);
    }
  };

  const confirmReverse = () => {
    if (entryToReverse) {
      reverseMutation.mutate(entryToReverse);
    }
  };

  const handlePrintReceipt = async (entry: any) => {
    // Fetch full customer info
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", entry.customer_id)
      .maybeSingle();

    // Fetch full company settings - shared
    const fullCompanySettings = await fetchSharedCompanySettings("*");

    // Fetch user profile for receiver name
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let receiverName = fullCompanySettings?.company_name || "";
    if (currentUser) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (profileData?.full_name) {
        receiverName = profileData.full_name;
      }
    }

    // Generate sequential receipt number based on paid entries count
    const { count: receiptCount } = await supabase
      .from("financial_entries")
      .select("*", { count: "exact", head: true })
      .eq("type", "income")
      .eq("payment_status", "paid");
    
    const receiptNumber = (receiptCount || 0) + 1;

    await generatePaymentReceipt({
      receiptNumber: receiptNumber,
      description: entry.description,
      customerName: customerData?.name || entry.customers?.name || "Não informado",
      customerCpfCnpj: customerData?.cpf_cnpj || undefined,
      customerAddress: customerData?.address || undefined,
      customerPhone: customerData?.phone || undefined,
      customerEmail: customerData?.email || undefined,
      customerCity: (customerData as any)?.city || undefined,
      customerState: (customerData as any)?.state || undefined,
      customerCep: (customerData as any)?.cep || undefined,
      amount: Number(entry.amount),
      paymentMethod: entry.payment_method || "pix",
      paidAt: entry.paid_at || new Date().toISOString(),
      dueDate: entry.due_date || undefined,
      companyName: fullCompanySettings?.company_name || undefined,
      companyPhone: fullCompanySettings?.phone || undefined,
      companyEmail: fullCompanySettings?.email || undefined,
      companyAddress: fullCompanySettings?.address || undefined,
      companyCnpj: fullCompanySettings?.cnpj_cpf || undefined,
      logoUrl: fullCompanySettings?.logo_url || undefined,
      receiptLogoUrl: (fullCompanySettings as any)?.receipt_logo_url || undefined,
      receivedByName: receiverName,
    });
    toast({ title: "Recibo gerado!" });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => 
      prev.includes(monthKey) 
        ? prev.filter(m => m !== monthKey)
        : [...prev, monthKey]
    );
  };

  // Filter entries by search first
  const filteredEntries = entries?.filter(entry => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    const descriptionMatch = entry.description.toLowerCase().includes(searchLower);
    const customerMatch = entry.customers?.name?.toLowerCase().includes(searchLower);
    return descriptionMatch || customerMatch;
  });

  // Group filtered entries by month
  const entriesByMonth = filteredEntries?.reduce((acc, entry) => {
    const paidDate = entry.paid_at ? new Date(entry.paid_at) : new Date();
    const year = getYear(paidDate);
    const month = getMonth(paidDate);
    const key = `${year}-${month}`;
    
    if (!acc[key]) {
      acc[key] = {
        year,
        month,
        monthName: monthNames[month],
        entries: [],
        total: 0
      };
    }
    acc[key].entries.push(entry);
    acc[key].total += Number(entry.amount);
    return acc;
  }, {} as Record<string, { year: number; month: number; monthName: string; entries: any[]; total: number }>) || {};

  // Filter by selected year and sort
  const sortedMonths = Object.values(entriesByMonth)
    .filter(m => m.year === selectedYear)
    .sort((a, b) => b.month - a.month);

  const total = entries?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const yearTotal = sortedMonths.reduce((sum, m) => sum + m.total, 0);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Get available years
  const availableYears = [...new Set(entries?.map(e => {
    const date = e.paid_at ? new Date(e.paid_at) : new Date();
    return getYear(date);
  }) || [new Date().getFullYear()])].sort((a, b) => b - a);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <span className="truncate">Recebimentos</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              Valores já recebidos por mês
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background min-w-0"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Badge variant="secondary" className="text-sm sm:text-lg px-2 sm:px-4 py-1 whitespace-nowrap">
              {formatCurrency(yearTotal)}
            </Badge>
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
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : sortedMonths.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum recebimento em {selectedYear}.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedMonths.map((monthData) => {
              const monthKey = `${monthData.year}-${monthData.month}`;
              const isExpanded = expandedMonths.includes(monthKey);
              
              return (
                <Collapsible key={monthKey} open={isExpanded} onOpenChange={() => toggleMonth(monthKey)}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between p-3 sm:p-4 h-auto hover:bg-muted/50 min-w-0"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                        <span className="font-medium truncate">{monthData.monthName}</span>
                        <Badge variant="outline" className="shrink-0 hidden sm:inline-flex">
                          {monthData.entries.length}
                        </Badge>
                      </div>
                      <span className="font-bold text-green-600 shrink-0 ml-2 text-sm sm:text-base">{formatCurrency(monthData.total)}</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden">
                    <div className="border rounded-lg mx-1 sm:mx-4 mb-4 overflow-hidden max-w-full">
                      {/* Mobile view */}
                      <div className="md:hidden divide-y overflow-hidden">
                        {monthData.entries.map((entry) => (
                          <div key={entry.id} className="p-2 sm:p-3 space-y-1.5 overflow-hidden">
                            <div className="flex justify-between items-start gap-1 min-w-0 overflow-hidden">
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="font-medium text-xs sm:text-sm line-clamp-1">{entry.description}</p>
                                {entry.customers && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {entry.customers.name}
                                  </p>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handlePrintReceipt(entry)}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    Imprimir Recibo
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleReverseClick(entry)}
                                    className="text-amber-600"
                                  >
                                    <Undo2 className="h-4 w-4 mr-2" />
                                    Estornar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="flex items-center justify-between gap-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1 min-w-0 overflow-hidden flex-1">
                                {entry.payment_method && (
                                  <Badge variant="outline" className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 shrink-0">
                                    {paymentMethodIcons[entry.payment_method]}
                                  </Badge>
                                )}
                                {entry.paid_at && (
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {format(new Date(entry.paid_at), "dd/MM", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-green-600 text-xs shrink-0">
                                {formatCurrency(Number(entry.amount))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop view */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table className="min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Forma</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthData.entries.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="font-medium">
                                  {entry.description}
                                  {entry.installments && entry.installments > 1 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({entry.current_installment}/{entry.installments})
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>{entry.customers?.name || "-"}</TableCell>
                                <TableCell>
                                  {entry.paid_at
                                    ? format(new Date(entry.paid_at), "dd/MM/yyyy", { locale: ptBR })
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {entry.payment_method ? (
                                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                      {paymentMethodIcons[entry.payment_method]}
                                      {paymentMethodLabels[entry.payment_method]}
                                    </Badge>
                                  ) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-bold text-green-600">
                                  {formatCurrency(Number(entry.amount))}
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handlePrintReceipt(entry)}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Imprimir Recibo
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleReverseClick(entry)}
                                        className="text-amber-600"
                                      >
                                        <Undo2 className="h-4 w-4 mr-2" />
                                        Estornar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Reverse Payment Dialog */}
      <AlertDialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja estornar este pagamento? Ele voltará para a lista de contas em aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReverse}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recebimento</AlertDialogTitle>
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
    </Card>
  );
}
