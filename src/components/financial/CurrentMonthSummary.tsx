import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Calendar,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHideValues } from "@/hooks/useHideValues";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CurrentMonthSummary() {
  useFinancialRealtime();
  const { hideValues, formatValue } = useHideValues();

  const { data: summary } = useQuery({
    queryKey: ["current-month-summary"],
    staleTime: 10000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const currentMonthNum = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [entriesRes, subPaymentsRes] = await Promise.all([
        supabase.from("financial_entries").select("id, type, amount, payment_status, paid_at, remaining_amount"),
        supabase.from("subscription_payments").select("id, amount, payment_status, financial_entry_id, paid_at, month, year"),
      ]);
      
      if (entriesRes.error) throw entriesRes.error;
      if (subPaymentsRes.error) throw subPaymentsRes.error;

      const entries = entriesRes.data || [];
      const subscriptionPayments = subPaymentsRes.data || [];

      // IDs de financial_entries que vieram de subscription_payments
      const subscriptionFinancialEntryIds = new Set(
        subscriptionPayments
          .filter((p: any) => p.financial_entry_id)
          .map((p: any) => p.financial_entry_id)
      );

      // Filter entries paid in current month
      const currentMonthIncome = entries.filter(e => {
        if (e.type !== "income" || e.payment_status !== "paid" || !e.paid_at) return false;
        if (subscriptionFinancialEntryIds.has(e.id)) return false;
        const paidDate = parseISO(e.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      });

      const currentMonthExpenses = entries.filter(e => {
        if (e.type !== "expense" || e.payment_status !== "paid" || !e.paid_at) return false;
        const paidDate = parseISO(e.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      });

      // Subscription payments for current month
      const currentMonthSubPayments = subscriptionPayments.filter((p: any) => {
        if (p.payment_status !== "paid" || !p.paid_at) return false;
        const paidDate = parseISO(p.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      });

      const paidIncomeFromFinancial = currentMonthIncome.reduce((sum, e) => sum + Number(e.amount), 0);
      const paidSubscriptionIncome = currentMonthSubPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const paidIncome = paidIncomeFromFinancial + paidSubscriptionIncome;

      const paidExpenses = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const balance = paidIncome - paidExpenses;

      return {
        monthLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR }),
        paidIncome,
        paidExpenses,
        balance,
      };
    },
  });

  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const cards = [
    {
      title: "Receita do Mês",
      value: summary?.paidIncome || 0,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
      tooltip: "Total de receitas recebidas no mês atual.",
    },
    {
      title: "Despesa do Mês",
      value: summary?.paidExpenses || 0,
      icon: TrendingDown,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      tooltip: "Total de despesas pagas no mês atual.",
    },
    {
      title: "Saldo do Mês",
      value: summary?.balance || 0,
      icon: Wallet,
      color: (summary?.balance || 0) >= 0 ? "text-accent" : "text-destructive",
      bgColor: (summary?.balance || 0) >= 0 ? "bg-accent/10" : "bg-destructive/10",
      tooltip: "Diferença entre receitas e despesas do mês atual.",
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="capitalize">{summary?.monthLabel || "Mês Atual"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {cards.map((card) => (
              <div 
                key={card.title} 
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
              >
                <div className={cn("p-2 rounded-lg shrink-0", card.bgColor)}>
                  <card.icon className={cn("h-4 w-4", card.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground truncate">{card.title}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p>{card.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className={cn("text-sm font-bold", card.color)}>
                    {formatValue(card.value, formatCurrency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
