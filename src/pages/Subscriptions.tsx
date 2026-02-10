import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Plus, 
  RefreshCcw,
  Calendar,
  Copy
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { SubscriptionPaymentsDialog } from "@/components/subscriptions/SubscriptionPaymentsDialog";
import { TableSkeleton } from "@/components/ui/page-skeleton";

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
  customers?: { name: string } | null;
}

export default function Subscriptions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [subscriptionForPayments, setSubscriptionForPayments] = useState<Subscription | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`*, customers(name)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!user,
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('subscriptions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_payments' },
        () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related financial entries first
      const { data: payments } = await supabase
        .from("subscription_payments")
        .select("financial_entry_id")
        .eq("subscription_id", id);
      
      if (payments) {
        for (const payment of payments) {
          if (payment.financial_entry_id) {
            await supabase.from("financial_entries").delete().eq("id", payment.financial_entry_id);
          }
        }
      }
      
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["received-payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      toast({ title: "Assinatura excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir assinatura", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (subscription: Subscription) => {
      if (!user) throw new Error("User not authenticated");
      
      const { error } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        customer_id: subscription.customer_id,
        title: `${subscription.title} (Cópia)`,
        description: subscription.description,
        monthly_value: subscription.monthly_value,
        start_date: format(new Date(), "yyyy-MM-dd"),
        payment_day: subscription.payment_day,
        notes: subscription.notes,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast({ title: "Assinatura duplicada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao duplicar assinatura", variant: "destructive" });
    },
  });

  const handleEdit = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedSubscription(null);
    setFormOpen(true);
  };

  const handleOpenPayments = (subscription: Subscription) => {
    setSubscriptionForPayments(subscription);
    setPaymentsDialogOpen(true);
  };

  const filteredSubscriptions = subscriptions?.filter(
    (sub) =>
      sub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalMonthly = subscriptions?.filter(s => s.is_active).reduce((sum, s) => sum + Number(s.monthly_value), 0) || 0;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div className="overflow-hidden">
        <h1 className="text-2xl md:text-3xl font-bold truncate">Assinaturas Recorrentes</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">
          Gerencie suas assinaturas mensais de clientes fixos
        </p>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Receita Mensal Recorrente</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(totalMonthly)}</p>
            </div>
            <RefreshCcw className="h-10 w-10 text-primary/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Assinaturas ({filteredSubscriptions?.length || 0})
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar assinaturas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleNew} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Assinatura
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-4"><TableSkeleton rows={5} columns={6} /></div>
          ) : filteredSubscriptions?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma assinatura encontrada</p>
              <p className="text-sm">Crie assinaturas para clientes com serviços mensais recorrentes</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3 overflow-x-hidden">
                {filteredSubscriptions?.map((subscription) => (
                  <div key={subscription.id} className="border rounded-lg p-4 space-y-3 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium truncate">{subscription.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{subscription.customers?.name || "-"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenPayments(subscription)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Pagamentos do Ano
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(subscription)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(subscription.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Badge variant={subscription.is_active ? "default" : "secondary"}>
                          {subscription.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Últ. dia útil
                        </span>
                      </div>
                      <span className="font-semibold text-primary">
                        {formatCurrency(subscription.monthly_value)}/mês
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor Mensal</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions?.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-medium">{subscription.title}</TableCell>
                        <TableCell>{subscription.customers?.name || "-"}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(subscription.monthly_value)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">Último dia útil</TableCell>
                        <TableCell>
                          <Badge variant={subscription.is_active ? "default" : "secondary"}>
                            {subscription.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(subscription.start_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenPayments(subscription)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                Pagamentos do Ano
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateMutation.mutate(subscription)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(subscription.id)}
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

      <SubscriptionFormDialog
        subscription={selectedSubscription}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["subscriptions"] })}
      />

      <SubscriptionPaymentsDialog
        subscription={subscriptionForPayments}
        open={paymentsDialogOpen}
        onOpenChange={setPaymentsDialogOpen}
      />
    </div>
  );
}
