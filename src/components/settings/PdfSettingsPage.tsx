import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { FileText, Palette, Layout, AlignLeft, Loader2, Save, Eye, Lock } from "lucide-react";

interface PdfSettings {
  id?: string;
  show_logo: boolean;
  logo_position: string;
  logo_size: string;
  show_company_name: boolean;
  header_color: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  show_category: boolean;
  show_validity: boolean;
  show_item_numbers: boolean;
  show_subtotal: boolean;
  show_discount: boolean;
  show_footer: boolean;
  footer_text: string;
  show_page_numbers: boolean;
  table_header_color: string;
  table_alternate_rows: boolean;
  table_border_style: string;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
}

const defaultSettings: PdfSettings = {
  show_logo: true,
  logo_position: "left",
  logo_size: "medium",
  show_company_name: true,
  header_color: "#000000",
  primary_color: "#ff005c",
  secondary_color: "#000000",
  font_family: "helvetica",
  font_size: "medium",
  show_category: true,
  show_validity: true,
  show_item_numbers: true,
  show_subtotal: true,
  show_discount: true,
  show_footer: true,
  footer_text: "",
  show_page_numbers: true,
  table_header_color: "#ff005c",
  table_alternate_rows: true,
  table_border_style: "solid",
  margin_top: 20,
  margin_bottom: 20,
  margin_left: 20,
  margin_right: 20,
};

export function PdfSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);

  const { data: isAdmin } = useQuery({
    queryKey: ["current-user-role-pdf"],
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

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["pdf-settings"],
    queryFn: async () => {
      // Fetch the admin's PDF settings (first record created)
      const { data, error } = await supabase
        .from("pdf_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        ...defaultSettings,
        ...savedSettings,
      });
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      const data = {
        user_id: user.id,
        ...settings,
      };

      if (savedSettings?.id) {
        const { error } = await supabase
          .from("pdf_settings")
          .update(data)
          .eq("id", savedSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pdf_settings")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-settings"] });
      toast({ title: "Configurações de PDF salvas!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  const updateSetting = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem editar as configurações de PDF. Você pode visualizar as configurações atuais.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="header" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="header" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Cabeçalho
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <AlignLeft className="h-4 w-4" />
            Conteúdo
          </TabsTrigger>
          <TabsTrigger value="style" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Estilo
          </TabsTrigger>
          <TabsTrigger value="footer" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rodapé
          </TabsTrigger>
        </TabsList>

        <TabsContent value="header">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Cabeçalho</CardTitle>
              <CardDescription>Personalize como o cabeçalho aparece nos PDFs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar Logo</Label>
                  <p className="text-sm text-muted-foreground">Exibir logo da empresa no cabeçalho</p>
                </div>
                <Switch
                  checked={settings.show_logo}
                  onCheckedChange={(v) => updateSetting("show_logo", v)}
                  disabled={!isAdmin}
                />
              </div>

              {settings.show_logo && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Posição da Logo</Label>
                      <Select
                        value={settings.logo_position}
                        onValueChange={(v) => updateSetting("logo_position", v)}
                        disabled={!isAdmin}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Esquerda</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="right">Direita</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tamanho da Logo</Label>
                      <Select
                        value={settings.logo_size}
                        onValueChange={(v) => updateSetting("logo_size", v)}
                        disabled={!isAdmin}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Pequeno</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar Nome da Empresa</Label>
                  <p className="text-sm text-muted-foreground">Exibir nome da empresa no cabeçalho</p>
                </div>
                <Switch
                  checked={settings.show_company_name}
                  onCheckedChange={(v) => updateSetting("show_company_name", v)}
                  disabled={!isAdmin}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor do Cabeçalho</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.header_color}
                    onChange={(e) => updateSetting("header_color", e.target.value)}
                    className="w-16 h-10 p-1"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={settings.header_color}
                    onChange={(e) => updateSetting("header_color", e.target.value)}
                    className="flex-1"
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Conteúdo</CardTitle>
              <CardDescription>Defina quais informações aparecem nos PDFs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <Label>Mostrar Categoria</Label>
                  <Switch
                    checked={settings.show_category}
                    onCheckedChange={(v) => updateSetting("show_category", v)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Mostrar Validade</Label>
                  <Switch
                    checked={settings.show_validity}
                    onCheckedChange={(v) => updateSetting("show_validity", v)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Numerar Itens</Label>
                  <Switch
                    checked={settings.show_item_numbers}
                    onCheckedChange={(v) => updateSetting("show_item_numbers", v)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Mostrar Subtotal</Label>
                  <Switch
                    checked={settings.show_subtotal}
                    onCheckedChange={(v) => updateSetting("show_subtotal", v)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Mostrar Desconto</Label>
                  <Switch
                    checked={settings.show_discount}
                    onCheckedChange={(v) => updateSetting("show_discount", v)}
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium">Margens (mm)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Superior</Label>
                    <Input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.margin_top}
                      onChange={(e) => updateSetting("margin_top", parseInt(e.target.value) || 20)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inferior</Label>
                    <Input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.margin_bottom}
                      onChange={(e) => updateSetting("margin_bottom", parseInt(e.target.value) || 20)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Esquerda</Label>
                    <Input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.margin_left}
                      onChange={(e) => updateSetting("margin_left", parseInt(e.target.value) || 20)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Direita</Label>
                    <Input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.margin_right}
                      onChange={(e) => updateSetting("margin_right", parseInt(e.target.value) || 20)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="style">
          <Card>
            <CardHeader>
              <CardTitle>Estilo Visual</CardTitle>
              <CardDescription>Personalize as cores e fontes dos PDFs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) => updateSetting("primary_color", e.target.value)}
                      className="w-16 h-10 p-1"
                      disabled={!isAdmin}
                    />
                    <Input
                      value={settings.primary_color}
                      onChange={(e) => updateSetting("primary_color", e.target.value)}
                      className="flex-1"
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.secondary_color}
                      onChange={(e) => updateSetting("secondary_color", e.target.value)}
                      className="w-16 h-10 p-1"
                      disabled={!isAdmin}
                    />
                    <Input
                      value={settings.secondary_color}
                      onChange={(e) => updateSetting("secondary_color", e.target.value)}
                      className="flex-1"
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select
                    value={settings.font_family}
                    onValueChange={(v) => updateSetting("font_family", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helvetica">Helvetica</SelectItem>
                      <SelectItem value="times">Times New Roman</SelectItem>
                      <SelectItem value="courier">Courier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho da Fonte</Label>
                  <Select
                    value={settings.font_size}
                    onValueChange={(v) => updateSetting("font_size", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Pequeno</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="large">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium">Tabela de Itens</h4>
                <div className="space-y-2">
                  <Label>Cor do Cabeçalho da Tabela</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.table_header_color}
                      onChange={(e) => updateSetting("table_header_color", e.target.value)}
                      className="w-16 h-10 p-1"
                      disabled={!isAdmin}
                    />
                    <Input
                      value={settings.table_header_color}
                      onChange={(e) => updateSetting("table_header_color", e.target.value)}
                      className="flex-1"
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Linhas Alternadas</Label>
                  <Switch
                    checked={settings.table_alternate_rows}
                    onCheckedChange={(v) => updateSetting("table_alternate_rows", v)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estilo de Borda</Label>
                  <Select
                    value={settings.table_border_style}
                    onValueChange={(v) => updateSetting("table_border_style", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Sólida</SelectItem>
                      <SelectItem value="dashed">Tracejada</SelectItem>
                      <SelectItem value="none">Sem Borda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Rodapé</CardTitle>
              <CardDescription>Personalize o rodapé dos PDFs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar Rodapé</Label>
                  <p className="text-sm text-muted-foreground">Exibir rodapé personalizado</p>
                </div>
                <Switch
                  checked={settings.show_footer}
                  onCheckedChange={(v) => updateSetting("show_footer", v)}
                  disabled={!isAdmin}
                />
              </div>

              {settings.show_footer && (
                <div className="space-y-2">
                  <Label>Texto do Rodapé</Label>
                  <Textarea
                    value={settings.footer_text}
                    onChange={(e) => updateSetting("footer_text", e.target.value)}
                    placeholder="Texto que aparecerá no rodapé de todos os PDFs..."
                    rows={3}
                    disabled={!isAdmin}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Número de Páginas</Label>
                  <p className="text-sm text-muted-foreground">Exibir numeração de páginas</p>
                </div>
                <Switch
                  checked={settings.show_page_numbers}
                  onCheckedChange={(v) => updateSetting("show_page_numbers", v)}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <div className="flex justify-end gap-4">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-primary"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      )}
    </div>
  );
}
