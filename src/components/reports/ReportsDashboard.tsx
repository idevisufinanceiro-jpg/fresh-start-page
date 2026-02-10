import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Loader2, Download, Filter, Crown, Percent, Wallet, Eye, EyeOff, Info, Calendar, ShoppingBag, CreditCard, Package, User, MapPin, Phone, Mail, FileText, Check, ChevronsUpDown, CalendarDays, ChevronDown } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, addMonths, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useHideValues } from "@/hooks/useHideValues";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { generateReportPDF, type FinancialReportData, type CustomerReportData } from "@/lib/generateReportPDF";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "#8b5cf6", "#ec4899", "#06b6d4"];

export function ReportsDashboard() {
  // Realtime updates
  useFinancialRealtime();
  
  const { user } = useAuth();
  const { hideValues, toggleHideValues, formatValue } = useHideValues();
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // Month navigation helpers
  const setCurrentMonth = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
  };

  const setPreviousMonth = () => {
    const prev = subMonths(new Date(), 1);
    setStartDate(format(startOfMonth(prev), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(prev), "yyyy-MM-dd"));
  };

  const setLast3Months = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
  };

  const setLast6Months = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
  };

  const setCurrentYear = () => {
    const now = new Date();
    setStartDate(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
    setEndDate(format(new Date(now.getFullYear(), 11, 31), "yyyy-MM-dd"));
  };

  // Fetch all data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports-data", startDate, endDate],
    queryFn: async () => {
      const [financialRes, salesRes, quotesRes, customersRes, categoriesRes, subscriptionsRes, subPaymentsRes, companyRes] = await Promise.all([
        supabase.from("financial_entries").select("*, customers(name), expense_categories(name, color)").gte("created_at", startDate).lte("created_at", endDate + "T23:59:59"),
        supabase.from("sales").select("*, customers(name)").gte("sold_at", startDate).lte("sold_at", endDate + "T23:59:59"),
        supabase.from("quotes").select("*, customers(name)").gte("created_at", startDate).lte("created_at", endDate + "T23:59:59"),
        supabase.from("customers").select("*"),
        supabase.from("expense_categories").select("*"),
        supabase.from("subscriptions").select("*, customers(name)").eq("is_active", true),
        supabase.from("subscription_payments").select("*"),
        supabase.from("company_settings").select("*").maybeSingle(),
      ]);

      return {
        financialEntries: financialRes.data || [],
        sales: salesRes.data || [],
        quotes: quotesRes.data || [],
        customers: customersRes.data || [],
        categories: categoriesRes.data || [],
        subscriptions: subscriptionsRes.data || [],
        subscriptionPayments: subPaymentsRes.data || [],
        companySettings: companyRes.data,
      };
    },
    enabled: !!user,
  });

  const financialEntries = reportData?.financialEntries || [];
  const sales = reportData?.sales || [];
  const customers = reportData?.customers || [];
  const categories = reportData?.categories || [];
  const subscriptions = reportData?.subscriptions || [];
  const subscriptionPayments = reportData?.subscriptionPayments || [];
  const companySettings = reportData?.companySettings;

  // Get IDs of financial entries that come from subscription payments (to avoid duplication)
  const subscriptionFinancialEntryIds = new Set(
    subscriptionPayments
      .filter((p: any) => p.financial_entry_id)
      .map((p: any) => p.financial_entry_id)
  );

  // Filter data by customer
  const filteredFinancialEntries = financialEntries.filter(e => 
    customerFilter === "all" || e.customer_id === customerFilter
  );
  const filteredSales = sales.filter(s => 
    customerFilter === "all" || s.customer_id === customerFilter
  );

  // Calculate metrics - exclude income entries that come from subscriptions to avoid duplication
  const paidIncome = filteredFinancialEntries
    .filter(e => e.type === "income" && e.payment_status === "paid" && !subscriptionFinancialEntryIds.has(e.id))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  
  const pendingIncome = filteredFinancialEntries
    .filter(e => e.type === "income" && (e.payment_status === "pending" || e.payment_status === "partial") && !subscriptionFinancialEntryIds.has(e.id))
    .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

  const paidExpenses = filteredFinancialEntries
    .filter(e => e.type === "expense" && e.payment_status === "paid")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const pendingExpenses = filteredFinancialEntries
    .filter(e => e.type === "expense" && e.payment_status === "pending")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Add subscription payments - since we excluded financial_entries that came from subscriptions,
  // we need to add ALL paid subscription payments here
  const rangeStart = parseISO(startDate);
  const rangeEnd = parseISO(endDate + "T23:59:59");

  const paidSubPayments = subscriptionPayments
    .filter((p: any) => {
      if (p.payment_status !== "paid") return false;
      if (!p.paid_at) return false;
      const paidDate = parseISO(p.paid_at);
      return isWithinInterval(paidDate, { start: rangeStart, end: rangeEnd });
    })
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  // Calculate pending subscription payments
  let pendingSubPayments = 0;
  const today = new Date();
  const futureLimit = addMonths(today, 12);
  
  subscriptions.forEach((subscription: any) => {
    const subStartDate = parseISO(subscription.start_date);
    const subEndDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
    let currentMonth = startOfMonth(subStartDate);
    
    while (isBefore(currentMonth, subEndDate) && isBefore(currentMonth, futureLimit)) {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();

      const existingPayment = subscriptionPayments.find(
        (p: any) => p.subscription_id === subscription.id && p.month === month && p.year === year
      );

      if (!existingPayment || existingPayment.payment_status === "pending") {
        pendingSubPayments += Number(subscription.monthly_value);
      }

      currentMonth = addMonths(currentMonth, 1);
    }
  });

  const totalPaidIncome = paidIncome + paidSubPayments;
  const totalPendingIncome = pendingIncome + pendingSubPayments;
  const totalSalesValue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const profit = totalPaidIncome - paidExpenses;
  const profitMargin = totalPaidIncome > 0 ? ((profit / totalPaidIncome) * 100) : 0;

  // Break-even calculation - same logic as Dashboard (income / expenses * 100)
  // For reports, use the totals from selected period
  const breakEvenProgress = paidExpenses > 0 ? (totalPaidIncome / paidExpenses) * 100 : (totalPaidIncome > 0 ? 200 : 0);
  
  // Surplus/deficit calculation
  const surplusDeficit = totalPaidIncome - paidExpenses;

  // Top customers by sales
  const topCustomersBySales = useMemo(() => {
    const customerSalesMap = new Map<string, { name: string; total: number; count: number }>();
    
    filteredSales.forEach(sale => {
      if (sale.customer_id && sale.customers?.name) {
        const existing = customerSalesMap.get(sale.customer_id);
        if (existing) {
          existing.total += sale.total;
          existing.count += 1;
        } else {
          customerSalesMap.set(sale.customer_id, {
            name: sale.customers.name,
            total: sale.total,
            count: 1
          });
        }
      }
    });

    return Array.from(customerSalesMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  // Top customers by subscription value
  const topCustomersBySubscription = useMemo(() => {
    const customerSubMap = new Map<string, { name: string; monthlyValue: number }>();
    
    subscriptions.forEach((sub: any) => {
      if (sub.customer_id && sub.customers?.name) {
        const existing = customerSubMap.get(sub.customer_id);
        if (existing) {
          existing.monthlyValue += Number(sub.monthly_value);
        } else {
          customerSubMap.set(sub.customer_id, {
            name: sub.customers.name,
            monthlyValue: Number(sub.monthly_value)
          });
        }
      }
    });

    return Array.from(customerSubMap.values())
      .sort((a, b) => b.monthlyValue - a.monthlyValue)
      .slice(0, 5);
  }, [subscriptions]);

  // Selected customer profile data
  const selectedCustomer = useMemo(() => {
    if (customerFilter === "all") return null;
    return customers.find(c => c.id === customerFilter);
  }, [customerFilter, customers]);

  const customerProfile = useMemo(() => {
    if (!selectedCustomer) return null;

    // Customer sales - only paid sales in the period
    const rangeStartCustomer = parseISO(startDate);
    const rangeEndCustomer = parseISO(endDate + "T23:59:59");
    
    const customerSales = sales.filter(s => {
      if (s.customer_id !== selectedCustomer.id) return false;
      if (s.payment_status !== 'paid') return false; // Only paid sales
      // Use paid_at if available, otherwise use sold_at for paid sales
      const saleDate = parseISO(s.paid_at || s.sold_at);
      return isWithinInterval(saleDate, { start: rangeStartCustomer, end: rangeEndCustomer });
    });
    const totalSalesAmount = customerSales.reduce((sum, s) => sum + s.total, 0);
    const salesCount = customerSales.length;

    // Customer subscriptions
    const customerSubscriptions = subscriptions.filter((s: any) => s.customer_id === selectedCustomer.id);
    const totalMonthlySubscription = customerSubscriptions.reduce((sum: number, s: any) => sum + Number(s.monthly_value), 0);

    // Customer subscription payments (filtered by period)
    const customerSubPayments = subscriptionPayments.filter((p: any) => {
      const sub = subscriptions.find((s: any) => s.id === p.subscription_id);
      if (sub?.customer_id !== selectedCustomer.id || p.payment_status !== "paid" || !p.paid_at) return false;
      const paidDate = parseISO(p.paid_at);
      return isWithinInterval(paidDate, { start: rangeStartCustomer, end: rangeEndCustomer });
    });
    const totalSubPaymentsReceived = customerSubPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const subPaymentsCount = customerSubPayments.length;

    // Customer financial entries (income) - use unfiltered entries
    const customerIncomeEntries = financialEntries.filter(e => {
      if (e.customer_id !== selectedCustomer.id || e.type !== "income" || e.payment_status !== "paid" || !e.paid_at) return false;
      const paidDate = parseISO(e.paid_at);
      return isWithinInterval(paidDate, { start: rangeStartCustomer, end: rangeEndCustomer });
    });
    const totalIncomeFromEntries = customerIncomeEntries.reduce((sum, e) => sum + Number(e.amount), 0);

    // Total revenue from this customer (sales + subscriptions paid)
    const totalRevenue = totalSalesAmount + totalSubPaymentsReceived;
    
    // Average ticket considering both sales and subscription payments
    const totalTransactions = salesCount + subPaymentsCount;
    const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Most purchased services/items
    const itemsMap = new Map<string, { description: string; quantity: number; total: number }>();
    customerSales.forEach(sale => {
      // Group by sale title as a proxy for service type
      const existing = itemsMap.get(sale.title);
      if (existing) {
        existing.quantity += 1;
        existing.total += sale.total;
      } else {
        itemsMap.set(sale.title, {
          description: sale.title,
          quantity: 1,
          total: sale.total
        });
      }
    });
    const topItems = Array.from(itemsMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Monthly purchase history
    const monthlyHistory: { month: string; value: number }[] = [];
    let current = startOfMonth(parseISO(startDate));
    const endDate_ = parseISO(endDate);
    
    while (current <= endDate_) {
      const monthStart = startOfMonth(current);
      const monthEnd = endOfMonth(current);
      
      const monthValue = customerSales
        .filter(s => {
          const saleDate = parseISO(s.sold_at);
          return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, s) => sum + s.total, 0);

      const monthSubValue = customerSubPayments
        .filter((p: any) => {
          if (!p.paid_at) return false;
          const paidDate = parseISO(p.paid_at);
          return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      monthlyHistory.push({
        month: format(current, "MMM/yy", { locale: ptBR }),
        value: monthValue + monthSubValue
      });

      current = addMonths(current, 1);
    }

    // Payment methods preference
    const paymentMethods: Record<string, number> = {};
    customerSales.forEach(s => {
      if (s.payment_method) {
        paymentMethods[s.payment_method] = (paymentMethods[s.payment_method] || 0) + 1;
      }
    });
    const preferredPaymentMethod = Object.entries(paymentMethods)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "Não definido";

    // First and last purchase
    const sortedSales = [...customerSales].sort((a, b) => 
      new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime()
    );
    const firstPurchase = sortedSales[0]?.sold_at;
    const lastPurchase = sortedSales[sortedSales.length - 1]?.sold_at;

    return {
      customer: selectedCustomer,
      totalRevenue,
      totalSalesAmount,
      salesCount,
      avgSaleValue,
      totalMonthlySubscription,
      totalSubPaymentsReceived,
      subPaymentsCount,
      subscriptionsCount: customerSubscriptions.length,
      topItems,
      monthlyHistory,
      preferredPaymentMethod,
      firstPurchase,
      lastPurchase,
      totalTransactions,
    };
  }, [selectedCustomer, sales, subscriptions, subscriptionPayments, financialEntries, startDate, endDate]);

  // Monthly data for charts
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const monthlyData: { month: string; receitas: number; despesas: number; lucro: number }[] = [];
  let current = startOfMonth(start);
  
  while (current <= end) {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    
    const monthPaidIncome = filteredFinancialEntries
      .filter(e => {
        if (e.type !== "income" || e.payment_status !== "paid" || !e.paid_at) return false;
        const paidDate = parseISO(e.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const monthPaidSubs = subscriptionPayments
      .filter((p: any) => {
        if (p.payment_status !== "paid" || p.financial_entry_id || !p.paid_at) return false;
        const paidDate = parseISO(p.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const monthPaidExpenses = filteredFinancialEntries
      .filter(e => {
        if (e.type !== "expense" || e.payment_status !== "paid" || !e.paid_at) return false;
        const paidDate = parseISO(e.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalMonthIncome = monthPaidIncome + monthPaidSubs;

    monthlyData.push({
      month: format(current, "MMM/yy", { locale: ptBR }),
      receitas: totalMonthIncome,
      despesas: monthPaidExpenses,
      lucro: totalMonthIncome - monthPaidExpenses,
    });

    current = addMonthsHelper(current, 1);
  }

  function addMonthsHelper(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  // Category distribution for paid expenses
  const categoryData = categories.map(cat => {
    const total = filteredFinancialEntries
      .filter(e => e.type === "expense" && e.payment_status === "paid" && e.category_id === cat.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      name: cat.name,
      value: total,
      color: cat.color,
    };
  }).filter(c => c.value > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Removed formatCompactCurrency - always show full values with cents in Reports

  // Export to PDF functions
  const [isExporting, setIsExporting] = useState(false);

  const handleExportFinancialPDF = async () => {
    setIsExporting(true);
    try {
      const reportPdfData: FinancialReportData = {
        type: 'financial',
        startDate,
        endDate,
        summary: {
          totalPaidIncome,
          totalPendingIncome,
          paidExpenses,
          pendingExpenses,
          profit,
          profitMargin,
          breakEvenProgress,
          surplusDeficit,
          salesCount: filteredSales.length,
        },
        monthlyData,
        categoryData,
        topCustomersBySales,
        topCustomersBySubscription,
        companySettings,
      };
      
      await generateReportPDF(reportPdfData);
      toast.success("Relatório financeiro exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCustomerPDF = async () => {
    if (!customerProfile) return;
    
    setIsExporting(true);
    try {
      const reportPdfData: CustomerReportData = {
        type: 'customer',
        startDate,
        endDate,
        customerProfile,
        companySettings,
      };
      
      await generateReportPDF(reportPdfData);
      toast.success("Relatório do cliente exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxSalesValue = Math.max(...topCustomersBySales.map(c => c.total), 1);
  const maxSubValue = Math.max(...topCustomersBySubscription.map(c => c.monthlyValue), 1);

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Filtros do Relatório</h3>
                <p className="text-xs text-muted-foreground">Configure o período e cliente</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {/* Quick period selection */}
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>Atalhos</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={setCurrentMonth}>
                      Mês Atual
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={setPreviousMonth}>
                      Mês Anterior
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={setLast3Months}>
                      Últimos 3 Meses
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={setLast6Months}>
                      Últimos 6 Meses
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={setCurrentYear}>
                      Ano Atual
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-9 w-48 justify-between font-normal"
                    >
                      <span className="truncate">
                        {customerFilter === "all" 
                          ? "Todos os clientes" 
                          : customers.find(c => c.id === customerFilter)?.name || "Selecionar..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => setCustomerFilter("all")}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                customerFilter === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Todos os clientes
                          </CommandItem>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => setCustomerFilter(customer.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  customerFilter === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {customer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleHideValues} 
                  className="h-9"
                  title={hideValues ? "Mostrar valores" : "Ocultar valores"}
                >
                  {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={customerProfile ? handleExportCustomerPDF : handleExportFinancialPDF} 
                  className="h-9"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-1" />
                  )}
                  Baixar PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Profile View - Shows when a specific customer is selected */}
      {customerProfile ? (
        <div className="space-y-6">
          {/* Customer Header */}
          <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{customerProfile.customer.name}</h2>
                    {customerProfile.customer.company && (
                      <p className="text-muted-foreground">{customerProfile.customer.company}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {customerProfile.customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customerProfile.customer.email}
                        </span>
                      )}
                      {customerProfile.customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customerProfile.customer.phone}
                        </span>
                      )}
                      {customerProfile.customer.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {customerProfile.customer.city}{customerProfile.customer.state ? `, ${customerProfile.customer.state}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Receita Total do Cliente</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatValue(customerProfile.totalRevenue, formatCurrency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total em Vendas</span>
                </div>
                <p className="text-xl font-bold">{formatValue(customerProfile.totalSalesAmount, formatCurrency)}</p>
                <p className="text-xs text-muted-foreground">{customerProfile.salesCount} vendas realizadas</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Assinaturas Recebidas</span>
                </div>
                <p className="text-xl font-bold">{formatValue(customerProfile.totalSubPaymentsReceived, formatCurrency)}</p>
                <p className="text-xs text-muted-foreground">{customerProfile.subPaymentsCount} pagamento(s) • {formatValue(customerProfile.totalMonthlySubscription, formatCurrency)}/mês ativo</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Ticket Médio</span>
                </div>
                <p className="text-xl font-bold">{formatValue(customerProfile.avgSaleValue, formatCurrency)}</p>
                <p className="text-xs text-muted-foreground">{customerProfile.totalTransactions} transações (vendas + assinaturas)</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Forma de Pagamento</span>
                </div>
                <p className="text-xl font-bold capitalize">{customerProfile.preferredPaymentMethod}</p>
                <p className="text-xs text-muted-foreground">mais utilizada</p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Purchase Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Purchase History Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-5 w-5 text-primary" />
                  Histórico de Compras
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customerProfile.monthlyHistory.some(m => m.value > 0) ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customerProfile.monthlyHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => hideValues ? "•••" : `${(value / 1000).toFixed(0)}k`}
                          width={40}
                        />
                        <RechartsTooltip 
                          formatter={(value: number) => [hideValues ? "••••••" : formatCurrency(value), "Valor"]}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem histórico de compras no período
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most Purchased Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5 text-success" />
                  Serviços Mais Comprados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customerProfile.topItems.length > 0 ? (
                  <div className="space-y-3">
                    {customerProfile.topItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[180px]">{item.description}</p>
                            <p className="text-xs text-muted-foreground">{item.quantity}x comprado(s)</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{formatValue(item.total, formatCurrency)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de compras
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Customer Timeline Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                {customerProfile.firstPurchase && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Primeira compra:</span>
                    <span className="font-medium">{format(parseISO(customerProfile.firstPurchase), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {customerProfile.lastPurchase && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Última compra:</span>
                    <span className="font-medium">{format(parseISO(customerProfile.lastPurchase), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Receita Total:</span>
                  <span className="font-bold text-primary">{formatValue(customerProfile.totalRevenue, formatCurrency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
      {/* KPI Cards Row 1 - Main Metrics */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Revenue Card */}
          <Card className="overflow-visible">
            <CardContent className="p-0">
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-muted-foreground">Receita Total</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs z-50">
                        <p>Total de receitas PAGAS no período selecionado. Baseado nas entradas financeiras com status "Pago".</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
                    <TrendingUp className="h-3 w-3" />
                    Pagas
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatValue(totalPaidIncome, formatCurrency)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{formatValue(totalPendingIncome, formatCurrency)} a receber
                </p>
              </div>
              <div className="h-16 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData.slice(-4)}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="receitas" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#colorReceitas)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Total Expenses Card */}
          <Card className="overflow-visible">
            <CardContent className="p-0">
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-muted-foreground">Despesas Total</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs z-50">
                        <p>Total de despesas PAGAS no período selecionado. Baseado nas entradas financeiras de despesas com status "Pago".</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                    <TrendingDown className="h-3 w-3" />
                    Pagas
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatValue(paidExpenses, formatCurrency)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{formatValue(pendingExpenses, formatCurrency)} pendentes
                </p>
              </div>
              <div className="h-16 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData.slice(-4)}>
                    <defs>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#colorDespesas)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Profit Card */}
          <Card className="overflow-visible">
            <CardContent className="p-0">
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-muted-foreground">Lucro Líquido</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs z-50">
                        <p>Lucro = Receitas Pagas - Despesas Pagas. Representa o resultado financeiro líquido no período.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${profit >= 0 ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10'}`}>
                    <Percent className="h-3 w-3" />
                    {profitMargin.toFixed(1)}%
                  </div>
                </div>
                <p className={`text-3xl font-bold ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatValue(profit, formatCurrency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredSales.length} vendas + assinaturas • {formatValue(totalPaidIncome, formatCurrency)} em receitas
                </p>
              </div>
              <div className="h-16 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData.slice(-4)}>
                    <defs>
                      <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorLucro)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Break-even and Stats Row */}
      <TooltipProvider delayDuration={300}>
        {/* Break-even Card - Full width horizontal layout */}
        <Card className="relative overflow-hidden">
            {/* Background gradient indicator */}
            <div 
              className={`absolute inset-0 opacity-5 ${
                breakEvenProgress >= 100 
                  ? 'bg-gradient-to-br from-success via-success/50 to-transparent' 
                  : breakEvenProgress >= 75 
                    ? 'bg-gradient-to-br from-warning via-warning/50 to-transparent'
                    : 'bg-gradient-to-br from-destructive via-destructive/50 to-transparent'
              }`}
            />
            
            <CardHeader className="pb-2 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`p-2 rounded-xl ${
                    breakEvenProgress >= 100 
                      ? 'bg-success/10' 
                      : breakEvenProgress >= 75 
                        ? 'bg-warning/10'
                        : 'bg-destructive/10'
                  }`}>
                    <Target className={`h-5 w-5 ${
                      breakEvenProgress >= 100 
                        ? 'text-success' 
                        : breakEvenProgress >= 75 
                          ? 'text-warning'
                          : 'text-destructive'
                    }`} />
                  </div>
                  <span className="flex items-center gap-1.5">
                    Ponto de Equilíbrio
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] text-xs">
                        <p>Indica quando suas receitas cobrem 100% das despesas no período. Acima de 100% = lucro. Abaixo = prejuízo.</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
              <div className={`text-2xl font-bold ${
                breakEvenProgress >= 100 
                  ? 'text-success' 
                  : breakEvenProgress >= 75 
                    ? 'text-warning'
                    : 'text-destructive'
              }`}>
                {hideValues ? "••••" : `${Math.min(breakEvenProgress, 999).toFixed(0)}%`}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 relative">
            {/* Progress bar with milestone markers */}
            <div className="space-y-2">
              <div className="relative">
                <Progress 
                  value={Math.min(breakEvenProgress, 100)} 
                  className={`h-4 ${
                    breakEvenProgress >= 100 
                      ? '[&>div]:bg-success' 
                      : breakEvenProgress >= 75 
                        ? '[&>div]:bg-warning'
                        : '[&>div]:bg-destructive'
                  }`}
                />
                {/* Milestone markers */}
                <div className="absolute top-0 left-1/4 w-px h-4 bg-border/50" />
                <div className="absolute top-0 left-1/2 w-px h-4 bg-border/50" />
                <div className="absolute top-0 left-3/4 w-px h-4 bg-border/50" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Status explanation */}
            <div className={`p-3 rounded-lg border ${
              breakEvenProgress >= 100 
                ? 'bg-success/5 border-success/20' 
                : breakEvenProgress >= 75 
                  ? 'bg-warning/5 border-warning/20'
                  : 'bg-destructive/5 border-destructive/20'
            }`}>
              {breakEvenProgress >= 100 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm font-medium text-success">Meta Atingida!</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Suas receitas superaram suas despesas em{" "}
                    <span className="font-semibold text-success">
                      {formatValue(surplusDeficit, formatCurrency)}
                    </span>
                    . Você está{" "}
                    <span className="font-semibold text-success">
                      {hideValues ? "••••" : `${(breakEvenProgress - 100).toFixed(0)}%`}
                    </span>{" "}
                    acima do ponto de equilíbrio.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${breakEvenProgress >= 75 ? 'bg-warning' : 'bg-destructive'} animate-pulse`} />
                    <span className={`text-sm font-medium ${breakEvenProgress >= 75 ? 'text-warning' : 'text-destructive'}`}>
                      {breakEvenProgress >= 75 ? 'Quase lá!' : 'Atenção Necessária'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Faltam{" "}
                    <span className={`font-semibold ${breakEvenProgress >= 75 ? 'text-warning' : 'text-destructive'}`}>
                      {formatValue(Math.abs(surplusDeficit), formatCurrency)}
                    </span>{" "}
                    em receitas para cobrir suas despesas no período.
                  </p>
                </div>
              )}
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas Totais</p>
                </div>
                <p className="text-base font-bold text-destructive">
                  {formatValue(paidExpenses, formatCurrency)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receitas Totais</p>
                </div>
                <p className="text-base font-bold text-success">
                  {formatValue(totalPaidIncome, formatCurrency)}
                </p>
              </div>
            </div>

            {/* What's needed section - only show if below break-even */}
            {breakEvenProgress < 100 && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">O que falta para equilibrar:</p>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const deficit = Math.abs(surplusDeficit);
                    const avgSaleValue = filteredSales.length > 0 ? totalSalesValue / filteredSales.length : 0;
                    const salesNeeded = avgSaleValue > 0 ? Math.ceil(deficit / avgSaleValue) : 0;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <span className="text-xs text-muted-foreground">Valor necessário</span>
                          <span className="text-sm font-semibold">{formatValue(deficit, formatCurrency)}</span>
                        </div>
                        {avgSaleValue > 0 && (
                          <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <span className="text-xs text-muted-foreground">
                              Vendas estimadas (média {formatValue(avgSaleValue, formatCurrency)})
                            </span>
                            <span className="text-sm font-semibold">{hideValues ? "••" : salesNeeded} vendas</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Surplus section - only show if above break-even */}
            {breakEvenProgress >= 100 && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Excedente disponível:</p>
                <div className="flex items-center justify-between p-2 rounded-md bg-success/5 border border-success/20">
                  <span className="text-xs text-muted-foreground">Lucro após equilíbrio</span>
                  <span className="text-sm font-bold text-success">
                    {formatValue(surplusDeficit, formatCurrency)}
                  </span>
                </div>
              </div>
            )}

            {/* Info tooltip */}
            <div className="pt-2 border-t">
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                💡 O ponto de equilíbrio indica quando suas receitas cobrem 100% das despesas. 
                Acima de 100% significa lucro, abaixo indica déficit no período analisado.
              </p>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Revenue Chart - Enhanced */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Evolução Financeira</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Comparativo mensal de receitas vs despesas</p>
                </div>
              </div>
              
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-success">
                    {formatValue(monthlyData.reduce((sum, m) => sum + m.receitas, 0), formatCurrency)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-xs font-medium text-destructive">
                    {formatValue(monthlyData.reduce((sum, m) => sum + m.despesas, 0), formatCurrency)}
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                  monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'bg-warning/10 border border-warning/20'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${
                    monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 ? 'text-primary' : 'text-warning'
                  }`} />
                  <span className={`text-xs font-medium ${
                    monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 ? 'text-primary' : 'text-warning'
                  }`}>
                    {formatValue(monthlyData.reduce((sum, m) => sum + m.lucro, 0), formatCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-2">
            {/* Chart */}
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={2} barCategoryGap="15%">
                  <defs>
                    <linearGradient id="receitasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1}/>
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="despesasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1}/>
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="hsl(var(--border))" 
                    strokeOpacity={0.5}
                  />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    tickFormatter={(value) => hideValues ? "•••" : `${(value / 1000).toFixed(0)}k`}
                    width={45}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }}
                    formatter={(value: number, name: string) => [
                      hideValues ? "••••••" : formatCurrency(value),
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      padding: '12px 16px'
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                    itemStyle={{ fontSize: 12, padding: '2px 0' }}
                  />
                  <Bar 
                    dataKey="receitas" 
                    name="Receitas" 
                    fill="url(#receitasGradient)" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                  <Bar 
                    dataKey="despesas" 
                    name="Despesas" 
                    fill="url(#despesasGradient)" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly breakdown cards */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalhamento Mensal</p>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-success" />
                    <span>Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-destructive" />
                    <span>Despesas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                    <span>Lucro</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {monthlyData.slice(-6).map((month, index) => (
                  <div 
                    key={month.month} 
                    className={`p-2.5 rounded-lg border transition-all hover:shadow-md ${
                      month.lucro >= 0 
                        ? 'bg-success/5 border-success/20 hover:border-success/40' 
                        : 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                    }`}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center mb-1.5">
                      {month.month}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="text-[10px] font-medium text-success truncate">
                          {formatValue(month.receitas, formatCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        <span className="text-[10px] font-medium text-destructive truncate">
                          {formatValue(month.despesas, formatCurrency)}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <TrendingUp className={`w-2.5 h-2.5 ${month.lucro >= 0 ? 'text-primary' : 'text-warning'}`} />
                          <span className={`text-[10px] font-bold ${month.lucro >= 0 ? 'text-primary' : 'text-warning'} truncate`}>
                            {formatValue(month.lucro, formatCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance indicator */}
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-full ${
                    monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 
                      ? 'bg-success/10' 
                      : 'bg-warning/10'
                  }`}>
                    {monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-warning" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium">
                      {monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 
                        ? 'Período com resultado positivo' 
                        : 'Período com resultado negativo'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {monthlyData.filter(m => m.lucro >= 0).length} de {monthlyData.length} meses lucrativos
                    </p>
                  </div>
                </div>
                <div className={`text-right`}>
                  <p className={`text-lg font-bold ${
                    monthlyData.reduce((sum, m) => sum + m.lucro, 0) >= 0 ? 'text-success' : 'text-warning'
                  }`}>
                    {formatValue(monthlyData.reduce((sum, m) => sum + m.lucro, 0), formatCurrency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Resultado acumulado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Top Customers and Categories Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Customers by Sales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-warning" />
              Top Clientes (Vendas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCustomersBySales.length > 0 ? (
              topCustomersBySales.map((customer, index) => (
                <div key={customer.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate max-w-[120px]">{customer.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(customer.total)}</span>
                  </div>
                  <Progress value={(customer.total / maxSalesValue) * 100} className="h-2" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de vendas</p>
            )}
          </CardContent>
        </Card>

        {/* Top Customers by Subscription */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Top Clientes (Assinatura)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCustomersBySubscription.length > 0 ? (
              topCustomersBySubscription.map((customer, index) => (
                <div key={customer.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate max-w-[120px]">{customer.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(customer.monthlyValue)}/mês</span>
                  </div>
                  <Progress value={(customer.monthlyValue / maxSubValue) * 100} className="h-2" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sem assinaturas ativas</p>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-destructive" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Sem dados de despesas
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
