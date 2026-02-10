import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Building2, Upload, Save, Loader2, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CompanySettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    company_name: "",
    cnpj_cpf: "",
    email: "",
    phone: "",
    whatsapp: "",
    website: "",
    address: "",
    instagram: "",
    facebook: "",
    primary_color: "#6366f1",
    secondary_color: "#8b5cf6",
    quote_header_notes: "",
    quote_footer_notes: "",
    default_quote_message: "",
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [receiptLogoFile, setReceiptLogoFile] = useState<File | null>(null);
  const [receiptLogoPreview, setReceiptLogoPreview] = useState<string | null>(null);

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["current-user-role-company"],
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

  // Fetch shared company settings (first record - all users see same data)
  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*"),
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || "",
        cnpj_cpf: settings.cnpj_cpf || "",
        email: settings.email || "",
        phone: settings.phone || "",
        whatsapp: settings.whatsapp || "",
        website: settings.website || "",
        address: settings.address || "",
        instagram: settings.instagram || "",
        facebook: settings.facebook || "",
        primary_color: settings.primary_color || "#6366f1",
        secondary_color: settings.secondary_color || "#8b5cf6",
        quote_header_notes: settings.quote_header_notes || "",
        quote_footer_notes: settings.quote_footer_notes || "",
        default_quote_message: settings.default_quote_message || "",
      });
      if (settings.logo_url) {
        setLogoPreview(settings.logo_url);
      }
      if ((settings as any).receipt_logo_url) {
        setReceiptLogoPreview((settings as any).receipt_logo_url);
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      if (!isAdmin) throw new Error("Apenas administradores podem editar");
      if (!settings?.id) throw new Error("Configurações não encontradas");

      let logoUrl = settings?.logo_url;
      let receiptLogoUrl = (settings as any)?.receipt_logo_url;

      // Upload company logo if changed - use the public "branding" bucket
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop()?.toLowerCase();
        
        // Only allow PNG and JPEG formats (jsPDF doesn't support ICO)
        if (fileExt !== 'png' && fileExt !== 'jpg' && fileExt !== 'jpeg') {
          throw new Error("Formato de imagem não suportado. Use PNG ou JPEG.");
        }
        
        // Use a fixed path for the company logo in the public branding bucket
        const fileName = `company-logo.${fileExt}`;
        
        // First try to remove old files if exists (ignore errors)
        await supabase.storage.from("branding").remove([`company-logo.png`, `company-logo.jpg`, `company-logo.jpeg`]);
        
        const { error: uploadError } = await supabase.storage
          .from("branding")
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
        }

        const { data: publicUrl } = supabase.storage
          .from("branding")
          .getPublicUrl(fileName);
        
        logoUrl = publicUrl.publicUrl;
      }

      // Upload receipt logo if changed
      if (receiptLogoFile) {
        const fileExt = receiptLogoFile.name.split(".").pop()?.toLowerCase();
        
        if (fileExt !== 'png' && fileExt !== 'jpg' && fileExt !== 'jpeg') {
          throw new Error("Formato de imagem não suportado. Use PNG ou JPEG.");
        }
        
        const fileName = `receipt-logo.${fileExt}`;
        
        // Remove old receipt logo files
        await supabase.storage.from("branding").remove([`receipt-logo.png`, `receipt-logo.jpg`, `receipt-logo.jpeg`]);
        
        const { error: uploadError } = await supabase.storage
          .from("branding")
          .upload(fileName, receiptLogoFile, { upsert: true });

        if (uploadError) {
          console.error("Receipt logo upload error:", uploadError);
          throw new Error(`Erro ao fazer upload da logo do recibo: ${uploadError.message}`);
        }

        const { data: publicUrl } = supabase.storage
          .from("branding")
          .getPublicUrl(fileName);
        
        receiptLogoUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase
        .from("company_settings")
        .update({
          ...formData,
          logo_url: logoUrl,
          receipt_logo_url: receiptLogoUrl,
        })
        .eq("id", settings.id);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      setLogoFile(null);
      setReceiptLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["shared-company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (error: any) => {
      console.error(error);
      toast({ 
        title: "Erro ao salvar configurações", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReceiptLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
      {/* Admin-only notice */}
      {!isAdmin && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Apenas o administrador pode editar as configurações da empresa. Você pode visualizar, mas não alterar.
          </AlertDescription>
        </Alert>
      )}

      {/* Logo and Basic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Informações básicas da sua empresa</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Logo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="w-20 h-20 rounded-xl object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo da Empresa</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleLogoChange}
                    className="w-fit"
                  />
                  <p className="text-xs text-muted-foreground">Usada em orçamentos e vendas</p>
                </div>
              )}
            </div>

            {/* Receipt Logo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {receiptLogoPreview ? (
                  <img
                    src={receiptLogoPreview}
                    alt="Logo do Recibo"
                    className="w-20 h-20 rounded-xl object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="receipt_logo">Logo do Recibo</Label>
                  <Input
                    id="receipt_logo"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleReceiptLogoChange}
                    className="w-fit"
                  />
                  <p className="text-xs text-muted-foreground">Usada nos recibos de pagamento</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Sua Empresa Ltda"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
              <Input
                id="cnpj_cpf"
                value={formData.cnpj_cpf}
                onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                placeholder="00.000.000/0000-00"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 0000-0000"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.empresa.com"
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Rua, número, bairro, cidade - UF"
              rows={2}
              disabled={!isAdmin}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                placeholder="@suaempresa"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={formData.facebook}
                onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                placeholder="facebook.com/suaempresa"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Settings */}

      {/* Quote Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Orçamento</CardTitle>
          <CardDescription>Textos padrão para seus orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote_header_notes">Notas do Cabeçalho</Label>
            <Textarea
              id="quote_header_notes"
              value={formData.quote_header_notes}
              onChange={(e) => setFormData({ ...formData, quote_header_notes: e.target.value })}
              placeholder="Texto que aparece no início do orçamento..."
              rows={3}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote_footer_notes">Notas do Rodapé</Label>
            <Textarea
              id="quote_footer_notes"
              value={formData.quote_footer_notes}
              onChange={(e) => setFormData({ ...formData, quote_footer_notes: e.target.value })}
              placeholder="Termos e condições, formas de pagamento..."
              rows={3}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_quote_message">Mensagem Padrão</Label>
            <Textarea
              id="default_quote_message"
              value={formData.default_quote_message}
              onChange={(e) => setFormData({ ...formData, default_quote_message: e.target.value })}
              placeholder="Mensagem de agradecimento ou apresentação..."
              rows={3}
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button - Only for Admin */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="lg"
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
