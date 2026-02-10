import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { PdfSettingsPage } from "@/components/settings/PdfSettingsPage";
import { ThemeCustomizer } from "@/components/settings/ThemeCustomizer";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { MobileTabSelect, type TabOption } from "@/components/ui/mobile-tab-select";
import { Building2, User, FileText, Palette, HardDrive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("company");

  const { data: isAdmin } = useQuery({
    queryKey: ["current-user-role-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .single();

      if (error) return false;
      return data?.role === "admin";
    },
    enabled: !!user,
  });

  const tabOptions: TabOption[] = useMemo(() => {
    const options: TabOption[] = [
      { value: "company", label: "Empresa", icon: <Building2 className="h-4 w-4" /> },
      { value: "pdf", label: "Layout PDF", icon: <FileText className="h-4 w-4" /> },
    ];
    
    if (isAdmin) {
      options.push({ value: "theme", label: "Cores do Sistema", icon: <Palette className="h-4 w-4" /> });
    }
    
    options.push({ value: "account", label: "Minha Conta", icon: <User className="h-4 w-4" /> });
    
    if (isAdmin) {
      options.push({ value: "storage", label: "Armazenamento", icon: <HardDrive className="h-4 w-4" /> });
    }
    
    return options;
  }, [isAdmin]);

  return (
    <div className="space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        {/* Mobile: Select dropdown */}
        <MobileTabSelect
          value={activeTab}
          onValueChange={setActiveTab}
          options={tabOptions}
          className="sm:hidden"
        />

        {/* Desktop: Regular tabs */}
        <TabsList className={`hidden sm:grid sm:w-full ${isAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Layout PDF</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span>Cores do Sistema</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Minha Conta</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="storage" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              <span>Armazenamento</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="company" className="overflow-x-hidden">
          <CompanySettings />
        </TabsContent>

        <TabsContent value="pdf" className="overflow-x-hidden">
          <PdfSettingsPage />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="theme" className="overflow-x-hidden">
            <ThemeCustomizer />
          </TabsContent>
        )}

        <TabsContent value="account" className="overflow-x-hidden">
          <AccountSettings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="storage" className="overflow-x-hidden">
            <StorageSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
