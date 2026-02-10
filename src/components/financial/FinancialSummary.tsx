import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHideValues } from "@/hooks/useHideValues";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";

export function FinancialSummary() {
  // Realtime updates
  useFinancialRealtime();
  const { hideValues, formatValue } = useHideValues();

  const { data: summary } = useQuery({
    queryKey: ["financial-summary"],
    staleTime: 10000, // 10 segundos
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [entriesRes, subPaymentsRes] = await Promise.all([
        supabase.from("financial_entries").select("id, type, amount, payment_status, remaining_amount"),
        supabase.from("subscription_payments").select("id, amount, payment_status, financial_entry_id"),
      ]);
      
      if (entriesRes.error) throw entriesRes.error;
      if (subPaymentsRes.error) throw subPaymentsRes.error;

      const entries = entriesRes.data || [];
      const subscriptionPayments = subPaymentsRes.data || [];

      // IDs de financial_entries que vieram de subscription_payments (para evitar duplicação)
      const subscriptionFinancialEntryIds = new Set(
        subscriptionPayments
          .filter((p: any) => p.financial_entry_id)
          .map((p: any) => p.financial_entry_id)
      );

      // Excluir entries que vieram de assinaturas
      const income = entries.filter(e => e.type === "income" && !subscriptionFinancialEntryIds.has(e.id));
      const expenses = entries.filter(e => e.type === "expense");

      // Soma receitas de assinaturas pagas
      const paidSubscriptionIncome = subscriptionPayments
        .filter((p: any) => p.payment_status === "paid")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const totalIncomeFromFinancial = income.reduce((sum, e) => sum + Number(e.amount), 0);
      const paidIncomeFromFinancial = income.filter(e => e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const pendingIncomeFromFinancial = income.filter(e => e.payment_status === "pending" || e.payment_status === "partial")
        .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

      const totalIncome = totalIncomeFromFinancial + subscriptionPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const paidIncome = paidIncomeFromFinancial + paidSubscriptionIncome;
      const pendingIncome = pendingIncomeFromFinancial + subscriptionPayments
        .filter((p: any) => p.payment_status === "pending")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const paidExpenses = expenses.filter(e => e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const balance = paidIncome - paidExpenses;
      const profit = totalIncome - totalExpenses;

      return {
        totalIncome,
        paidIncome,
        pendingIncome,
        totalExpenses,
        paidExpenses,
        balance,
        profit,
      };
    },
  });

  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const cards = [
    {
      title: "Receita Total",
      value: summary?.totalIncome || 0,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
      tooltip: "Soma de todas as receitas registradas, incluindo pagas e pendentes.",
    },
    {
      title: "Receita Recebida",
      value: summary?.paidIncome || 0,
      icon: ArrowUpRight,
      color: "text-accent",
      bgColor: "bg-accent/10",
      tooltip: "Total de receitas já recebidas com status 'Pago'.",
    },
    {
      title: "A Receber",
      value: summary?.pendingIncome || 0,
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      tooltip: "Total de receitas pendentes aguardando recebimento.",
    },
    {
      title: "Despesas Total",
      value: summary?.totalExpenses || 0,
      icon: TrendingDown,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      tooltip: "Soma de todas as despesas registradas, incluindo pagas e pendentes.",
    },
    {
      title: "Despesas Pagas",
      value: summary?.paidExpenses || 0,
      icon: ArrowDownRight,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      tooltip: "Total de despesas já pagas com status 'Pago'.",
    },
    {
      title: "Saldo em Caixa",
      value: summary?.balance || 0,
      icon: Wallet,
      color: (summary?.balance || 0) >= 0 ? "text-accent" : "text-destructive",
      bgColor: (summary?.balance || 0) >= 0 ? "bg-accent/10" : "bg-destructive/10",
      tooltip: "Saldo = Receitas Recebidas - Despesas Pagas. Representa o dinheiro disponível.",
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-card overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between pb-2 overflow-visible">
              <div className="flex items-center gap-1.5 min-w-0">
                <CardTitle className="text-xs font-medium text-muted-foreground truncate">
                  {card.title}
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs z-50">
                    <p>{card.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className={cn("p-2 rounded-lg flex-shrink-0", card.bgColor)}>
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn("text-lg font-bold", card.color)}>
                {formatValue(card.value, formatCurrency)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
