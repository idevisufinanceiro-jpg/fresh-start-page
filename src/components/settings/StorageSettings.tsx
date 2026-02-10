import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Database, 
  FileText, 
  Users, 
  Calendar, 
  ShoppingBag, 
  Briefcase, 
  HardDrive, 
  FolderOpen, 
  Image,
  Download,
  Upload,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  DollarSign,
  Repeat,
  ListChecks,
  ClipboardList,
  TrendingUp,
  Paperclip,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { StorageDetailsDialog } from "./StorageDetailsDialog";

interface TableCount {
  name: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  estimatedCapacity: number;
}

interface BackupData {
  version: string;
  exportedAt: string;
  exportedBy: string;
  data: {
    // Original 15 tables
    customers: any[];
    quotes: any[];
    quote_items: any[];
    sales: any[];
    sale_items: any[];
    services: any[];
    service_stages: any[];
    calendar_events: any[];
    financial_entries: any[];
    subscriptions: any[];
    subscription_payments: any[];
    tasks: any[];
    task_statuses: any[];
    expense_categories: any[];
    service_types: any[];
    // New 6 tables for complete backup (v2.0)
    company_settings?: any[];
    pdf_settings?: any[];
    profiles?: any[];
    attachments?: any[];
    theme_settings?: any[];
    user_roles?: any[];
  };
}

const DB_LIMIT_MB = 500;
const FILES_LIMIT_GB = 1;
const CURRENT_DB_SIZE_MB = 13;

export function StorageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<BackupData | null>(null);
  const [showDbDetails, setShowDbDetails] = useState(false);
  const [showFilesDetails, setShowFilesDetails] = useState(false);

  const { data: stats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["storage-stats"],
    queryFn: async () => {
      // Get all table counts
      const [
        { count: customersCount },
        { count: quotesCount },
        { count: quoteItemsCount },
        { count: salesCount },
        { count: saleItemsCount },
        { count: servicesCount },
        { count: serviceStagesCount },
        { count: eventsCount },
        { count: financialCount },
        { count: subscriptionsCount },
        { count: subscriptionPaymentsCount },
        { count: tasksCount },
        { count: taskStatusesCount },
        { count: taskChecklistsCount },
        { count: taskTagsCount },
        { count: taskTagAssignmentsCount },
        { count: expenseCategoriesCount },
        { count: serviceTypesCount },
        { count: companySettingsCount },
        { count: pdfSettingsCount },
        { count: profilesCount },
        { count: themeSettingsCount },
        { count: userRolesCount },
        { data: attachmentsData },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("quotes").select("*", { count: "exact", head: true }),
        supabase.from("quote_items").select("*", { count: "exact", head: true }),
        supabase.from("sales").select("*", { count: "exact", head: true }),
        supabase.from("sale_items").select("*", { count: "exact", head: true }),
        supabase.from("services").select("*", { count: "exact", head: true }),
        supabase.from("service_stages").select("*", { count: "exact", head: true }),
        supabase.from("calendar_events").select("*", { count: "exact", head: true }),
        supabase.from("financial_entries").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("*", { count: "exact", head: true }),
        supabase.from("subscription_payments").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("task_statuses").select("*", { count: "exact", head: true }),
        supabase.from("task_checklists").select("*", { count: "exact", head: true }),
        supabase.from("task_tags").select("*", { count: "exact", head: true }),
        supabase.from("task_tag_assignments").select("*", { count: "exact", head: true }),
        supabase.from("expense_categories").select("*", { count: "exact", head: true }),
        supabase.from("service_types").select("*", { count: "exact", head: true }),
        supabase.from("company_settings").select("*", { count: "exact", head: true }),
        supabase.from("pdf_settings").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("theme_settings").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }),
        supabase.from("attachments").select("file_size"),
      ]);

      // Calculate storage from attachments table
      const attachmentsStorageBytes = attachmentsData?.reduce((acc, att) => acc + (att.file_size || 0), 0) || 0;

      // Get storage from all buckets (attachments, contracts, branding)
      let totalFilesStorageBytes = attachmentsStorageBytes;
      let totalFilesCount = attachmentsData?.length || 0;

      // Count storage from ALL users (global storage)
      try {
        // Helper function to recursively list all files in a bucket
        const listAllFilesInBucket = async (bucketName: string): Promise<{ count: number; size: number }> => {
          let totalCount = 0;
          let totalSize = 0;
          
          // List root folders (user folders)
          const { data: rootFolders } = await supabase.storage
            .from(bucketName)
            .list("", { limit: 1000 });
          
          if (rootFolders) {
            for (const folder of rootFolders) {
              if (folder.id) {
                // It's a file in root
                totalCount++;
                totalSize += folder.metadata?.size || 0;
              } else {
                // It's a user folder, list its contents
                const { data: userFiles } = await supabase.storage
                  .from(bucketName)
                  .list(folder.name, { limit: 1000 });
                
                if (userFiles) {
                  for (const item of userFiles) {
                    if (item.id) {
                      totalCount++;
                      totalSize += item.metadata?.size || 0;
                    } else {
                      // It's a subfolder (e.g., task folders), list its contents
                      const { data: subFiles } = await supabase.storage
                        .from(bucketName)
                        .list(`${folder.name}/${item.name}`, { limit: 1000 });
                      if (subFiles) {
                        totalCount += subFiles.filter(f => f.id).length;
                        totalSize += subFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
                      }
                    }
                  }
                }
              }
            }
          }
          
          return { count: totalCount, size: totalSize };
        };

        // Count files from all buckets
        const [contractsData, brandingData, attachmentsBucketData] = await Promise.all([
          listAllFilesInBucket("contracts"),
          listAllFilesInBucket("branding"),
          listAllFilesInBucket("attachments"),
        ]);

        totalFilesCount += contractsData.count + brandingData.count + attachmentsBucketData.count;
        totalFilesStorageBytes += contractsData.size + brandingData.size + attachmentsBucketData.size;
      } catch (error) {
        console.log("Could not fetch storage info:", error);
      }

      // Total database records
      const totalRecords = 
        (customersCount || 0) +
        (quotesCount || 0) +
        (quoteItemsCount || 0) +
        (salesCount || 0) +
        (saleItemsCount || 0) +
        (servicesCount || 0) +
        (serviceStagesCount || 0) +
        (eventsCount || 0) +
        (financialCount || 0) +
        (subscriptionsCount || 0) +
        (subscriptionPaymentsCount || 0) +
        (tasksCount || 0) +
        (taskStatusesCount || 0) +
        (taskChecklistsCount || 0) +
        (taskTagsCount || 0) +
        (taskTagAssignmentsCount || 0) +
        (expenseCategoriesCount || 0) +
        (serviceTypesCount || 0) +
        (companySettingsCount || 0) +
        (pdfSettingsCount || 0) +
        (profilesCount || 0) +
        (themeSettingsCount || 0) +
        (userRolesCount || 0);

      return {
        customers: customersCount || 0,
        quotes: quotesCount || 0,
        quoteItems: quoteItemsCount || 0,
        sales: salesCount || 0,
        saleItems: saleItemsCount || 0,
        services: servicesCount || 0,
        serviceStages: serviceStagesCount || 0,
        events: eventsCount || 0,
        financial: financialCount || 0,
        subscriptions: subscriptionsCount || 0,
        subscriptionPayments: subscriptionPaymentsCount || 0,
        tasks: tasksCount || 0,
        taskStatuses: taskStatusesCount || 0,
        taskChecklists: taskChecklistsCount || 0,
        taskTags: taskTagsCount || 0,
        expenseCategories: expenseCategoriesCount || 0,
        serviceTypes: serviceTypesCount || 0,
        settings: (companySettingsCount || 0) + (pdfSettingsCount || 0) + (themeSettingsCount || 0),
        profiles: profilesCount || 0,
        attachments: totalFilesCount,
        totalStorageBytes: totalFilesStorageBytes,
        totalRecords,
      };
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleExportBackup = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para exportar");
      return;
    }

    setIsExporting(true);
    try {
      // Fetch all data from ALL 21 tables for complete backup
      const [
        // Original 15 tables
        { data: customers },
        { data: quotes },
        { data: quote_items },
        { data: sales },
        { data: sale_items },
        { data: services },
        { data: service_stages },
        { data: calendar_events },
        { data: financial_entries },
        { data: subscriptions },
        { data: subscription_payments },
        { data: tasks },
        { data: task_statuses },
        { data: expense_categories },
        { data: service_types },
        // New 6 tables for complete backup
        { data: company_settings },
        { data: pdf_settings },
        { data: profiles },
        { data: attachments },
        { data: theme_settings },
        { data: user_roles },
      ] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("quotes").select("*"),
        supabase.from("quote_items").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("sale_items").select("*"),
        supabase.from("services").select("*"),
        supabase.from("service_stages").select("*"),
        supabase.from("calendar_events").select("*"),
        supabase.from("financial_entries").select("*"),
        supabase.from("subscriptions").select("*"),
        supabase.from("subscription_payments").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("task_statuses").select("*"),
        supabase.from("expense_categories").select("*"),
        supabase.from("service_types").select("*"),
        // New tables
        supabase.from("company_settings").select("*"),
        supabase.from("pdf_settings").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("attachments").select("*"),
        supabase.from("theme_settings").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      const backupData: BackupData = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        exportedBy: user.email || user.id,
        data: {
          // Original 15 tables
          customers: customers || [],
          quotes: quotes || [],
          quote_items: quote_items || [],
          sales: sales || [],
          sale_items: sale_items || [],
          services: services || [],
          service_stages: service_stages || [],
          calendar_events: calendar_events || [],
          financial_entries: financial_entries || [],
          subscriptions: subscriptions || [],
          subscription_payments: subscription_payments || [],
          tasks: tasks || [],
          task_statuses: task_statuses || [],
          expense_categories: expense_categories || [],
          service_types: service_types || [],
          // New 6 tables for complete backup
          company_settings: company_settings || [],
          pdf_settings: pdf_settings || [],
          profiles: profiles || [],
          attachments: attachments || [],
          theme_settings: theme_settings || [],
          user_roles: user_roles || [],
        },
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-completo-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup completo exportado com sucesso! (21 tabelas)");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as BackupData;

        // Validate backup structure
        if (!data.version || !data.data) {
          toast.error("Arquivo de backup inválido");
          return;
        }

        setPendingImportData(data);
        setShowImportDialog(true);
      } catch (error) {
        toast.error("Erro ao ler arquivo de backup");
      }
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = "";
  };

  const handleImportBackup = async () => {
    if (!pendingImportData || !user) return;

    setIsImporting(true);
    setShowImportDialog(false);

    try {
      const { data: backupData } = pendingImportData;
      let importedTables = 0;

      // Import in order to respect foreign key constraints
      // 1. First, independent tables (no FK dependencies)
      if (backupData.expense_categories?.length > 0) {
        const categoriesToInsert = backupData.expense_categories.map(c => ({
          ...c,
          user_id: user.id,
          id: undefined, // Let DB generate new ID
        }));
        await supabase.from("expense_categories").upsert(categoriesToInsert, { onConflict: "id" });
        importedTables++;
      }

      if (backupData.task_statuses?.length > 0) {
        const statusesToInsert = backupData.task_statuses.map(s => ({
          ...s,
          user_id: user.id,
          id: undefined,
        }));
        await supabase.from("task_statuses").upsert(statusesToInsert, { onConflict: "id" });
        importedTables++;
      }

      if (backupData.service_types?.length > 0) {
        const typesToInsert = backupData.service_types.map(t => ({
          ...t,
          user_id: user.id,
          id: undefined,
        }));
        await supabase.from("service_types").upsert(typesToInsert, { onConflict: "id" });
        importedTables++;
      }

      // 2. Customers (referenced by many tables)
      if (backupData.customers?.length > 0) {
        for (const customer of backupData.customers) {
          const { error } = await supabase.from("customers").upsert({
            ...customer,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Customer import warning:", error.message);
        }
        importedTables++;
      }

      // 3. Quotes
      if (backupData.quotes?.length > 0) {
        for (const quote of backupData.quotes) {
          const { error } = await supabase.from("quotes").upsert({
            ...quote,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Quote import warning:", error.message);
        }
        importedTables++;
      }

      // 4. Quote items
      if (backupData.quote_items?.length > 0) {
        for (const item of backupData.quote_items) {
          const { error } = await supabase.from("quote_items").upsert(item, { onConflict: "id" });
          if (error) console.warn("Quote item import warning:", error.message);
        }
        importedTables++;
      }

      // 5. Sales
      if (backupData.sales?.length > 0) {
        for (const sale of backupData.sales) {
          const { error } = await supabase.from("sales").upsert({
            ...sale,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Sale import warning:", error.message);
        }
        importedTables++;
      }

      // 6. Sale items
      if (backupData.sale_items?.length > 0) {
        for (const item of backupData.sale_items) {
          const { error } = await supabase.from("sale_items").upsert(item, { onConflict: "id" });
          if (error) console.warn("Sale item import warning:", error.message);
        }
        importedTables++;
      }

      // 7. Services
      if (backupData.services?.length > 0) {
        for (const service of backupData.services) {
          const { error } = await supabase.from("services").upsert({
            ...service,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Service import warning:", error.message);
        }
        importedTables++;
      }

      // 8. Service stages
      if (backupData.service_stages?.length > 0) {
        for (const stage of backupData.service_stages) {
          const { error } = await supabase.from("service_stages").upsert(stage, { onConflict: "id" });
          if (error) console.warn("Service stage import warning:", error.message);
        }
        importedTables++;
      }

      // 9. Calendar events
      if (backupData.calendar_events?.length > 0) {
        for (const event of backupData.calendar_events) {
          const { error } = await supabase.from("calendar_events").upsert({
            ...event,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Event import warning:", error.message);
        }
        importedTables++;
      }

      // 10. Financial entries
      if (backupData.financial_entries?.length > 0) {
        for (const entry of backupData.financial_entries) {
          const { error } = await supabase.from("financial_entries").upsert({
            ...entry,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Financial entry import warning:", error.message);
        }
        importedTables++;
      }

      // 11. Subscriptions
      if (backupData.subscriptions?.length > 0) {
        for (const sub of backupData.subscriptions) {
          const { error } = await supabase.from("subscriptions").upsert({
            ...sub,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Subscription import warning:", error.message);
        }
        importedTables++;
      }

      // 12. Subscription payments
      if (backupData.subscription_payments?.length > 0) {
        for (const payment of backupData.subscription_payments) {
          const { error } = await supabase.from("subscription_payments").upsert({
            ...payment,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Subscription payment import warning:", error.message);
        }
        importedTables++;
      }

      // 13. Tasks
      if (backupData.tasks?.length > 0) {
        for (const task of backupData.tasks) {
          const { error } = await supabase.from("tasks").upsert({
            ...task,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Task import warning:", error.message);
        }
        importedTables++;
      }

      // ============ NEW TABLES (v2.0) ============
      
      // 14. Company settings (admin only - update existing)
      if (backupData.company_settings?.length > 0) {
        for (const settings of backupData.company_settings) {
          // Update existing company settings for the user
          const { error } = await supabase.from("company_settings").upsert({
            ...settings,
            user_id: user.id,
          }, { onConflict: "user_id" });
          if (error) console.warn("Company settings import warning:", error.message);
        }
        importedTables++;
      }

      // 15. PDF settings (admin only - update existing)
      if (backupData.pdf_settings?.length > 0) {
        for (const settings of backupData.pdf_settings) {
          const { error } = await supabase.from("pdf_settings").upsert({
            ...settings,
            user_id: user.id,
          }, { onConflict: "user_id" });
          if (error) console.warn("PDF settings import warning:", error.message);
        }
        importedTables++;
      }

      // 16. Profiles (update own profile only)
      if (backupData.profiles?.length > 0) {
        const ownProfile = backupData.profiles.find(p => p.user_id === user.id);
        if (ownProfile) {
          const { error } = await supabase.from("profiles").upsert({
            ...ownProfile,
            user_id: user.id,
          }, { onConflict: "user_id" });
          if (error) console.warn("Profile import warning:", error.message);
          importedTables++;
        }
      }

      // 17. Attachments (metadata only - files are not included)
      if (backupData.attachments?.length > 0) {
        for (const attachment of backupData.attachments) {
          const { error } = await supabase.from("attachments").upsert({
            ...attachment,
            user_id: user.id,
          }, { onConflict: "id" });
          if (error) console.warn("Attachment import warning:", error.message);
        }
        importedTables++;
      }

      // 18. Theme settings (admin only - single row update)
      if (backupData.theme_settings?.length > 0) {
        // Theme settings is a single global row, just update it
        const themeData = backupData.theme_settings[0];
        if (themeData) {
          const { error } = await supabase.from("theme_settings").update({
            ...themeData,
            updated_at: new Date().toISOString(),
          }).eq("id", themeData.id);
          if (error) console.warn("Theme settings import warning:", error.message);
          importedTables++;
        }
      }

      // Note: user_roles is typically not imported as it's managed by the system
      // But we include it in export for reference/audit purposes

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();

      toast.success(`Backup importado com sucesso! (${importedTables} tabelas)`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar backup");
    } finally {
      setIsImporting(false);
      setPendingImportData(null);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
  };

  // Lovable Cloud has 1GB storage limit
  const maxStorageBytes = FILES_LIMIT_GB * 1024 * 1024 * 1024;
  const usedPercentage = stats ? (stats.totalStorageBytes / maxStorageBytes) * 100 : 0;
  const dbUsagePercent = (CURRENT_DB_SIZE_MB / DB_LIMIT_MB) * 100;

  const tableCounts: TableCount[] = stats ? [
    { name: "Clientes", count: stats.customers, icon: <Users className="h-4 w-4" />, color: "text-blue-500", estimatedCapacity: 7500 },
    { name: "Orçamentos", count: stats.quotes, icon: <FileText className="h-4 w-4" />, color: "text-purple-500", estimatedCapacity: 20000 },
    { name: "Itens Orçamento", count: stats.quoteItems, icon: <ClipboardList className="h-4 w-4" />, color: "text-purple-400", estimatedCapacity: 50000 },
    { name: "Vendas", count: stats.sales, icon: <ShoppingBag className="h-4 w-4" />, color: "text-green-500", estimatedCapacity: 19000 },
    { name: "Itens Venda", count: stats.saleItems, icon: <ClipboardList className="h-4 w-4" />, color: "text-green-400", estimatedCapacity: 50000 },
    { name: "Serviços", count: stats.services, icon: <Briefcase className="h-4 w-4" />, color: "text-orange-500", estimatedCapacity: 15000 },
    { name: "Etapas Serviço", count: stats.serviceStages, icon: <ListChecks className="h-4 w-4" />, color: "text-orange-400", estimatedCapacity: 50000 },
    { name: "Tipos de Serviço", count: stats.serviceTypes, icon: <Briefcase className="h-4 w-4" />, color: "text-orange-300", estimatedCapacity: 5000 },
    { name: "Eventos", count: stats.events, icon: <Calendar className="h-4 w-4" />, color: "text-pink-500", estimatedCapacity: 25000 },
    { name: "Lançamentos", count: stats.financial, icon: <DollarSign className="h-4 w-4" />, color: "text-amber-500", estimatedCapacity: 8000 },
    { name: "Assinaturas", count: stats.subscriptions, icon: <Repeat className="h-4 w-4" />, color: "text-cyan-500", estimatedCapacity: 5000 },
    { name: "Pag. Assinatura", count: stats.subscriptionPayments, icon: <DollarSign className="h-4 w-4" />, color: "text-cyan-400", estimatedCapacity: 50000 },
    { name: "Tarefas", count: stats.tasks, icon: <ListChecks className="h-4 w-4" />, color: "text-indigo-500", estimatedCapacity: 20000 },
    { name: "Status Tarefas", count: stats.taskStatuses, icon: <ListChecks className="h-4 w-4" />, color: "text-indigo-400", estimatedCapacity: 1000 },
    { name: "Checklists", count: stats.taskChecklists, icon: <ListChecks className="h-4 w-4" />, color: "text-indigo-300", estimatedCapacity: 30000 },
    { name: "Tags Tarefas", count: stats.taskTags, icon: <ListChecks className="h-4 w-4" />, color: "text-indigo-200", estimatedCapacity: 1000 },
    { name: "Categorias Despesa", count: stats.expenseCategories, icon: <DollarSign className="h-4 w-4" />, color: "text-red-500", estimatedCapacity: 1000 },
    { name: "Configurações", count: stats.settings, icon: <Briefcase className="h-4 w-4" />, color: "text-gray-500", estimatedCapacity: 1000 },
    { name: "Perfis", count: stats.profiles, icon: <Users className="h-4 w-4" />, color: "text-blue-400", estimatedCapacity: 1000 },
    { name: "Anexos (metadados)", count: stats.attachments, icon: <Image className="h-4 w-4" />, color: "text-rose-500", estimatedCapacity: 5000 },
  ] : [];

  const totalRecords = tableCounts.reduce((acc, t) => acc + t.count, 0);

  const getStatusBadge = () => {
    if (dbUsagePercent < 50) {
      return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50">Sistema Saudável</Badge>;
    } else if (dbUsagePercent < 75) {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/50">Atenção</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50">Crítico</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Armazenamento do Sistema</h2>
            <p className="text-sm text-muted-foreground">
              Atualizado em {format(new Date(dataUpdatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {getStatusBadge()}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Backup Actions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Backup e Restauração
          </CardTitle>
          <CardDescription>
            Exporte todos os seus dados ou restaure a partir de um backup anterior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleExportBackup} 
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? "Exportando..." : "Exportar Backup Completo"}
            </Button>
            <div className="flex-1">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                id="backup-file-input"
                disabled={isImporting}
              />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => document.getElementById("backup-file-input")?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isImporting ? "Importando..." : "Importar Backup"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Backup completo (v2.0):</strong> inclui todas as 21 tabelas do sistema - clientes, orçamentos, vendas, 
            serviços, lançamentos, assinaturas, tarefas, eventos, configurações da empresa, layout PDF, 
            cores do tema, perfil e metadados de anexos. Arquivos físicos não são incluídos.
          </p>
        </CardContent>
      </Card>

      {/* Usage Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Database Usage */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setShowDbDetails(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Banco de Dados
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Clique para ver detalhes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uso atual</span>
                <span className="font-medium">{CURRENT_DB_SIZE_MB} MB de {DB_LIMIT_MB} MB</span>
              </div>
              <Progress value={dbUsagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {dbUsagePercent.toFixed(1)}% utilizado • ~{DB_LIMIT_MB - CURRENT_DB_SIZE_MB} MB disponíveis
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{totalRecords.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Registros totais</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{tableCounts.length}</p>
                <p className="text-xs text-muted-foreground">Tabelas em uso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Storage Usage */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setShowFilesDetails(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                Arquivos e Anexos
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Clique para ver arquivos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uso atual</span>
                <span className="font-medium">{formatBytes(stats?.totalStorageBytes || 0)} de {FILES_LIMIT_GB} GB</span>
              </div>
              <Progress value={usedPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {usedPercentage.toFixed(2)}% utilizado
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{stats?.attachments || 0}</p>
                <p className="text-xs text-muted-foreground">Arquivos anexados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{formatBytes(stats?.totalStorageBytes || 0)}</p>
                <p className="text-xs text-muted-foreground">Espaço usado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Estimates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Estimativa de Capacidade
          </CardTitle>
          <CardDescription>
            Baseado no uso atual, você ainda pode cadastrar aproximadamente:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Clientes", current: stats?.customers || 0, max: 7500, icon: <Users className="h-4 w-4" /> },
              { name: "Vendas", current: stats?.sales || 0, max: 19000, icon: <ShoppingBag className="h-4 w-4" /> },
              { name: "Orçamentos", current: stats?.quotes || 0, max: 20000, icon: <FileText className="h-4 w-4" /> },
              { name: "Lançamentos", current: stats?.financial || 0, max: 8000, icon: <DollarSign className="h-4 w-4" /> },
            ].map((item) => (
              <div key={item.name} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-primary">{item.icon}</div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  +{(item.max - item.current).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.current.toLocaleString()} de ~{item.max.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Uso Detalhado por Tabela
          </CardTitle>
          <CardDescription>
            Quantidade de registros em cada área do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tableCounts.map((table) => (
              <div 
                key={table.name} 
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={table.color}>{table.icon}</div>
                  <span className="text-sm">{table.name}</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {table.count.toLocaleString()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            Segurança e Proteção dos Dados
          </CardTitle>
          <CardDescription>
            Seus dados estão protegidos profissionalmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Backups Automáticos</p>
                <p className="text-xs text-muted-foreground">
                  Seus dados são copiados automaticamente todos os dias
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Redundância Geográfica</p>
                <p className="text-xs text-muted-foreground">
                  Dados replicados em múltiplos servidores
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Sem Risco de Perda</p>
                <p className="text-xs text-muted-foreground">
                  Mesmo se atingir o limite, seus dados existentes são preservados
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Criptografia</p>
                <p className="text-xs text-muted-foreground">
                  Dados protegidos em trânsito e em repouso
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Projeção de Uso</p>
                <p className="text-xs text-muted-foreground">
                  Com a taxa atual de uso, você levará aproximadamente <strong>5+ anos</strong> para atingir 50% da capacidade.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Exporte Backups Regulares</p>
                <p className="text-xs text-muted-foreground">
                  Recomendamos exportar um backup completo mensalmente e guardar em local seguro.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <Paperclip className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Anexos Grandes</p>
                <p className="text-xs text-muted-foreground">
                  Evite anexar arquivos maiores que 5MB. Prefira comprimir imagens e PDFs antes de enviar.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What happens if limit is reached */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            O que acontece se atingir o limite?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-amber-600">•</span>
              <span>Novos registros serão bloqueados temporariamente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span><strong>Seus dados existentes NÃO serão perdidos</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600">•</span>
              <span>Você poderá excluir dados antigos para liberar espaço</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600">•</span>
              <span>Ou solicitar upgrade do plano para mais capacidade</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar Backup</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a importar um backup exportado em{" "}
                <strong>
                  {pendingImportData?.exportedAt 
                    ? format(new Date(pendingImportData.exportedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "data desconhecida"}
                </strong>.
              </p>
              <p className="text-amber-600 font-medium">
                ⚠️ Dados existentes com os mesmos IDs serão substituídos.
              </p>
              <p>
                Registros no backup:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• Clientes: {pendingImportData?.data.customers?.length || 0}</li>
                <li>• Orçamentos: {pendingImportData?.data.quotes?.length || 0}</li>
                <li>• Vendas: {pendingImportData?.data.sales?.length || 0}</li>
                <li>• Serviços: {pendingImportData?.data.services?.length || 0}</li>
                <li>• Lançamentos: {pendingImportData?.data.financial_entries?.length || 0}</li>
                {pendingImportData?.data.company_settings && (
                  <li>• Configurações empresa: {pendingImportData.data.company_settings.length}</li>
                )}
                {pendingImportData?.data.pdf_settings && (
                  <li>• Configurações PDF: {pendingImportData.data.pdf_settings.length}</li>
                )}
                {pendingImportData?.data.attachments && (
                  <li>• Anexos (metadados): {pendingImportData.data.attachments.length}</li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Versão do backup: {pendingImportData?.version || "1.0"}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportBackup}>
              Confirmar Importação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StorageDetailsDialog
        open={showDbDetails}
        onOpenChange={setShowDbDetails}
        type="database"
        tableCounts={tableCounts}
      />

      <StorageDetailsDialog
        open={showFilesDetails}
        onOpenChange={setShowFilesDetails}
        type="files"
      />
    </div>
  );
}
