import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialDashboard } from "@/components/financial/FinancialDashboard";
import { EntriesList } from "@/components/financial/EntriesList";
import { OpenAccountsList } from "@/components/financial/OpenAccountsList";
import { ReceivedPaymentsList } from "@/components/financial/ReceivedPaymentsList";
import { CategoryManager } from "@/components/financial/CategoryManager";
import { EntryFormDialog } from "@/components/financial/EntryFormDialog";
import { MonthlyForecast } from "@/components/financial/MonthlyForecast";
import { ExpensesByMonth } from "@/components/financial/ExpensesByMonth";
import { CurrentMonthSummary } from "@/components/financial/CurrentMonthSummary";
import { MobileTabSelect, type TabOption } from "@/components/ui/mobile-tab-select";
import { Clock, CheckCircle2, TrendingDown, Settings, CalendarDays } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type FinancialEntry = Tables<"financial_entries">;

export default function Financial() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(null);
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [activeTab, setActiveTab] = useState("forecast");

  const handleNewEntry = (type: "income" | "expense") => {
    setSelectedEntry(null);
    setEntryType(type);
    setDialogOpen(true);
  };

  const handleEditEntry = (entry: FinancialEntry) => {
    setSelectedEntry(entry);
    setEntryType(entry.type as "income" | "expense");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedEntry(null);
    }
  };

  const tabOptions: TabOption[] = [
    { value: "forecast", label: "Previsão Mensal", icon: <CalendarDays className="h-4 w-4" /> },
    { value: "open-accounts", label: "Contas em Aberto", icon: <Clock className="h-4 w-4" /> },
    { value: "received", label: "Recebidos", icon: <CheckCircle2 className="h-4 w-4" /> },
    { value: "expense", label: "Despesas", icon: <TrendingDown className="h-4 w-4" /> },
    { value: "categories", label: "Categorias", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div className="overflow-hidden">
        <h1 className="text-2xl md:text-3xl font-bold truncate">Financeiro</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">Controle suas receitas e despesas</p>
      </div>

      <CurrentMonthSummary />

      <FinancialDashboard />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full overflow-x-hidden">
        {/* Mobile: Select dropdown */}
        <MobileTabSelect
          value={activeTab}
          onValueChange={setActiveTab}
          options={tabOptions}
          className="sm:hidden"
        />

        {/* Desktop: Regular tabs */}
        <TabsList className="hidden sm:grid sm:w-full sm:grid-cols-5">
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>Previsão</span>
          </TabsTrigger>
          <TabsTrigger value="open-accounts" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Contas em Aberto</span>
          </TabsTrigger>
          <TabsTrigger value="received" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Recebidos</span>
          </TabsTrigger>
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            <span>Despesas</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Categorias</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forecast">
          <MonthlyForecast />
        </TabsContent>

        <TabsContent value="open-accounts">
          <OpenAccountsList
            onEditEntry={handleEditEntry}
          />
        </TabsContent>

        <TabsContent value="received">
          <ReceivedPaymentsList />
        </TabsContent>

        <TabsContent value="expense">
          <div className="space-y-6">
            <ExpensesByMonth />
            <EntriesList
              type="expense"
              onNewEntry={() => handleNewEntry("expense")}
              onEditEntry={handleEditEntry}
            />
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>

      <EntryFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        entry={selectedEntry}
        type={entryType}
      />
    </div>
  );
}
