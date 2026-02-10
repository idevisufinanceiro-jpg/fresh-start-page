import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Search, MoreHorizontal, Eye, Trash2, CheckCircle, Clock, Loader2, ShoppingBag, Edit, Plus, FileDown, Copy, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SaleFormDialog } from "./SaleFormDialog";
import { generateSalePDF } from "@/lib/generateSalePDF";
import { PartialPaymentDialog } from "@/components/financial/PartialPaymentDialog";
interface Sale {
  id: string;
  sale_number: string;
  title: string;
  description: string | null;
  subtotal: number;
  discount: number | null;
  total: number;
  payment_status: string;
  payment_method: string | null;
  sold_at: string;
  notes: string | null;
  customer_id: string | null;
  customers?: { name: string } | null;
  delivery_date?: string | null;
  installment_count?: number | null;
  installments_data?: any[] | null;
}

interface SalesListProps {
  onViewSale: (sale: Sale) => void;
}

export function SalesList({ onViewSale }: SalesListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [saleForPayment, setSaleForPayment] = useState<{
    id: string;
    description: string;
    totalAmount: number;
    remainingAmount: number;
  } | null>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`*, customers(name)`)
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro deletar eventos do calendário vinculados a essa venda
      await supabase.from("calendar_events").delete().eq("sale_id", id);
      
      // Depois deletar a venda
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Venda excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir venda", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (sale: Sale) => {
      // Get sale items
      const { data: items } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);

      // Get new sale number
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not found");

      const { data: saleNumber } = await supabase.rpc("generate_sale_number", { _user_id: userData.user.id });

      // Create new sale
      const { data: newSale, error } = await supabase
        .from("sales")
        .insert({
          user_id: userData.user.id,
          sale_number: saleNumber,
          title: `${sale.title} (Cópia)`,
          description: sale.description,
          customer_id: sale.customer_id,
          discount: sale.discount,
          notes: sale.notes,
          subtotal: sale.subtotal,
          total: sale.total,
          payment_status: "pending",
          payment_method: sale.payment_method,
          delivery_date: sale.delivery_date,
        })
        .select()
        .single();

      if (error) throw error;

      // Copy items
      if (items && items.length > 0) {
        await supabase.from("sale_items").insert(
          items.map((item) => ({
            sale_id: newSale.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Venda duplicada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao duplicar venda", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Update sale payment status
      const { error } = await supabase
        .from("sales")
        .update({
          payment_status: status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;

      // Sync financial entries linked to this sale
      if (status === "paid") {
        // Mark all linked financial entries as paid
        await supabase
          .from("financial_entries")
          .update({ 
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            remaining_amount: 0
          })
          .eq("sale_id", id);
      } else if (status === "pending") {
        // Revert to pending - get all entries and restore remaining_amount
        const { data: entries } = await supabase
          .from("financial_entries")
          .select("id, amount, original_amount")
          .eq("sale_id", id);
        
        if (entries) {
          for (const entry of entries) {
            await supabase
              .from("financial_entries")
              .update({ 
                payment_status: "pending",
                paid_at: null,
                remaining_amount: entry.original_amount || entry.amount
              })
              .eq("id", entry.id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const handleEditSale = (sale: Sale) => {
    setSelectedSale(sale);
    setFormOpen(true);
  };

  const handleNewSale = () => {
    setSelectedSale(null);
    setFormOpen(true);
  };

  const handleGeneratePDF = async (sale: Sale) => {
    try {
      // Fetch sale items
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);
      if (itemsError) throw itemsError;

      // Fetch company settings - shared for all users
      const settings = await fetchSharedCompanySettings("*");

      // Fetch full sale with customer
      const { data: fullSale, error: saleError } = await supabase
        .from("sales")
        .select("*, customers(*)")
        .eq("id", sale.id)
        .single();
      if (saleError) throw saleError;

      await generateSalePDF(fullSale, items || [], settings);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const filteredSales = sales?.filter(
    (sale) =>
      sale.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenPaymentDialog = async (sale: Sale) => {
    // Fetch financial entries to get remaining amount
    const { data: entries } = await supabase
      .from("financial_entries")
      .select("id, amount, remaining_amount, original_amount")
      .eq("sale_id", sale.id);
    
    const totalAmount = sale.total;
    const remainingAmount = entries?.reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0) || totalAmount;
    
    setSaleForPayment({
      id: sale.id,
      description: sale.title,
      totalAmount,
      remainingAmount,
    });
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (entryId: string, paidAmount: number, paymentMethod: string, isFullPayment: boolean) => {
    if (!saleForPayment || !user) return;
    
    try {
      // Get all pending financial entries for this sale
      const { data: entries } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("sale_id", saleForPayment.id)
        .in("payment_status", ["pending", "partial"]);
      
      if (!entries || entries.length === 0) {
        toast({ title: "Nenhuma entrada pendente encontrada", variant: "destructive" });
        return;
      }

      let remainingPaymentToApply = paidAmount;
      const now = new Date().toISOString();

      // Apply payment to entries in order
      for (const entry of entries) {
        if (remainingPaymentToApply <= 0) break;
        
        const entryRemaining = entry.remaining_amount ?? entry.amount;
        const paymentForEntry = Math.min(remainingPaymentToApply, entryRemaining);
        const newRemaining = entryRemaining - paymentForEntry;
        
        await supabase
          .from("financial_entries")
          .update({
            remaining_amount: newRemaining,
            payment_status: newRemaining <= 0 ? "paid" : "partial",
            payment_method: paymentMethod as any,
            paid_at: newRemaining <= 0 ? now : null,
          })
          .eq("id", entry.id);
        
        remainingPaymentToApply -= paymentForEntry;
      }

      // Check if all entries are now paid to update sale status
      const { data: updatedEntries } = await supabase
        .from("financial_entries")
        .select("payment_status, remaining_amount")
        .eq("sale_id", saleForPayment.id);
      
      const allPaid = updatedEntries?.every(e => e.payment_status === "paid");
      const anyPartial = updatedEntries?.some(e => e.payment_status === "partial" || (e.remaining_amount ?? 0) > 0);
      
      let newSaleStatus = "pending";
      if (allPaid) {
        newSaleStatus = "paid";
      } else if (anyPartial || paidAmount > 0) {
        newSaleStatus = "partial";
      }
      
      await supabase
        .from("sales")
        .update({
          payment_status: newSaleStatus,
          paid_at: newSaleStatus === "paid" ? now : null,
        })
        .eq("id", saleForPayment.id);

      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      
      toast({ title: "Pagamento registrado com sucesso!" });
      setPaymentDialogOpen(false);
      setSaleForPayment(null);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500/50"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "partial":
        return <Badge variant="outline" className="text-blue-600 border-blue-500/50">Parcial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Vendas ({filteredSales?.length || 0})
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vendas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleNewSale} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda encontrada</p>
              <p className="text-sm">Converta orçamentos aprovados em vendas ou crie uma nova venda</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3 overflow-x-hidden">
                {filteredSales?.map((sale) => (
                  <div key={sale.id} className="border rounded-lg p-4 space-y-3 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-mono text-xs text-muted-foreground truncate">{sale.sale_number}</p>
                        <p className="font-medium truncate">{sale.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{sale.customers?.name || "-"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewSale(sale)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneratePDF(sale)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Gerar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditSale(sale)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {sale.payment_status !== "paid" && (
                            <DropdownMenuItem onClick={() => handleOpenPaymentDialog(sale)}>
                              <Receipt className="h-4 w-4 mr-2" />
                              Dar Baixa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(sale)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(sale.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(sale.sold_at), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(sale.payment_status)}
                        <span className="font-semibold text-green-600">
                          {formatCurrency(sale.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales?.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.sale_number}</TableCell>
                        <TableCell className="font-medium">{sale.title}</TableCell>
                        <TableCell>{sale.customers?.name || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(sale.sold_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(sale.total)}
                        </TableCell>
                        <TableCell>{getStatusBadge(sale.payment_status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewSale(sale)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGeneratePDF(sale)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Gerar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditSale(sale)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {sale.payment_status !== "paid" && (
                                <DropdownMenuItem onClick={() => handleOpenPaymentDialog(sale)}>
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Dar Baixa
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => duplicateMutation.mutate(sale)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(sale.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SaleFormDialog
        sale={selectedSale}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sales"] })}
      />

      <PartialPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onConfirm={handleConfirmPayment}
        entryId={saleForPayment?.id || ""}
        description={saleForPayment?.description || ""}
        totalAmount={saleForPayment?.totalAmount || 0}
        remainingAmount={saleForPayment?.remainingAmount || 0}
      />
    </>
  );
}
