import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, CheckCircle, AlertTriangle } from "lucide-react";
import { format, startOfYear, endOfYear, eachMonthOfInterval, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyBreakEven {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  progress: number;
  surplus: number;
}

interface BreakEvenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyData: MonthlyBreakEven[];
  hideValues: boolean;
  formatCurrency: (value: number) => string;
}

export function BreakEvenModal({ 
  open, 
  onOpenChange, 
  monthlyData, 
  hideValues,
  formatCurrency 
}: BreakEvenModalProps) {
  const formatValue = (value: number) => hideValues ? "••••••" : formatCurrency(value);
  const formatPercent = (value: number) => hideValues ? "••••" : `${value.toFixed(0)}%`;

  const yearTotal = monthlyData.reduce((acc, m) => ({
    income: acc.income + m.income,
    expenses: acc.expenses + m.expenses,
  }), { income: 0, expenses: 0 });

  const yearProgress = yearTotal.expenses > 0 ? (yearTotal.income / yearTotal.expenses) * 100 : 100;
  const yearSurplus = yearTotal.income - yearTotal.expenses;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className={`p-2.5 rounded-xl ${yearProgress >= 100 ? 'bg-success/10' : 'bg-warning/10'}`}>
              <Target className={`h-6 w-6 ${yearProgress >= 100 ? 'text-success' : 'text-warning'}`} />
            </div>
            Ponto de Equilíbrio - {getYear(new Date())}
          </DialogTitle>
          <DialogDescription>
            Acompanhe o progresso das suas receitas em relação às despesas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Year Summary */}
          <div className={`p-5 rounded-2xl border-2 ${
            yearProgress >= 100 
              ? 'bg-success/5 border-success/20' 
              : 'bg-warning/5 border-warning/20'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {yearProgress >= 100 ? (
                  <CheckCircle className="h-8 w-8 text-success" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    {yearProgress >= 100 ? 'Meta Anual Atingida!' : 'Meta Anual em Progresso'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {yearProgress >= 100 
                      ? `Você está ${formatPercent(yearProgress - 100)} acima do ponto de equilíbrio`
                      : `Faltam ${formatPercent(100 - yearProgress)} para atingir o equilíbrio`
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${yearProgress >= 100 ? 'text-success' : 'text-warning'}`}>
                  {formatPercent(yearProgress)}
                </p>
                <p className="text-xs text-muted-foreground">do ano</p>
              </div>
            </div>

            <div className="relative mb-4">
              <Progress 
                value={Math.min(yearProgress, 100)} 
                className={`h-5 ${yearProgress >= 100 ? '[&>div]:bg-success' : '[&>div]:bg-warning'}`}
              />
              {yearProgress > 100 && (
                <div 
                  className="absolute top-0 left-0 h-5 bg-success/30 rounded-full transition-all"
                  style={{ width: `${Math.min(yearProgress, 200) / 2}%` }}
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-background/80 space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Receitas</span>
                </div>
                <p className="text-lg font-bold text-success">{formatValue(yearTotal.income)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/80 space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Despesas</span>
                </div>
                <p className="text-lg font-bold text-destructive">{formatValue(yearTotal.expenses)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/80 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Target className={`h-4 w-4 ${yearSurplus >= 0 ? 'text-success' : 'text-destructive'}`} />
                  <span className="text-xs text-muted-foreground">Saldo</span>
                </div>
                <p className={`text-lg font-bold ${yearSurplus >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatValue(yearSurplus)}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
              Detalhamento por Mês
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {monthlyData.map((month) => (
                <div 
                  key={month.month}
                  className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                    month.progress >= 100 
                      ? 'bg-success/5 border-success/20 hover:border-success/40' 
                      : month.progress >= 75 
                        ? 'bg-warning/5 border-warning/20 hover:border-warning/40'
                        : 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold capitalize">{month.monthLabel}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                      month.progress >= 100 
                        ? 'bg-success/10 text-success' 
                        : month.progress >= 75 
                          ? 'bg-warning/10 text-warning'
                          : 'bg-destructive/10 text-destructive'
                    }`}>
                      {formatPercent(month.progress)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress 
                      value={Math.min(month.progress, 100)} 
                      className={`h-2 ${
                        month.progress >= 100 
                          ? '[&>div]:bg-success' 
                          : month.progress >= 75 
                            ? '[&>div]:bg-warning'
                            : '[&>div]:bg-destructive'
                      }`}
                    />
                    
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="font-medium text-success">{formatValue(month.income)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Despesa</span>
                        <span className="font-medium text-destructive">{formatValue(month.expenses)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground">Saldo</span>
                        <span className={`font-bold ${month.surplus >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {month.surplus >= 0 ? '+' : ''}{formatValue(month.surplus)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-4 rounded-xl bg-muted/30 border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 <strong>O que é o Ponto de Equilíbrio?</strong> É o momento em que suas receitas são iguais às suas despesas (100%). 
              Acima de 100% significa lucro, abaixo indica que as despesas superaram as receitas no período. 
              O percentual continua crescendo conforme o lucro aumenta.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
