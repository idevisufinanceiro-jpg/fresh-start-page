import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Palette, Monitor, Smartphone, LogIn, Save, Loader2, RotateCcw, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Convert hex to HSL
function hexToHsl(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

interface ThemeSettings {
  id: string;
  desktop_primary_color: string;
  desktop_secondary_color: string;
  desktop_background_color: string;
  desktop_foreground_color: string;
  desktop_sidebar_bg_color: string;
  desktop_sidebar_text_color: string;
  desktop_sidebar_accent_color: string;
  desktop_button_bg_color: string;
  desktop_button_text_color: string;
  desktop_button_hover_color: string;
  desktop_card_bg_color: string;
  desktop_card_border_color: string;
  desktop_input_bg_color: string;
  desktop_input_border_color: string;
  desktop_muted_color: string;
  desktop_muted_foreground_color: string;
  mobile_primary_color: string;
  mobile_secondary_color: string;
  mobile_background_color: string;
  mobile_foreground_color: string;
  mobile_header_bg_color: string;
  mobile_header_text_color: string;
  mobile_nav_bg_color: string;
  mobile_nav_text_color: string;
  mobile_nav_active_color: string;
  mobile_button_bg_color: string;
  mobile_button_text_color: string;
  mobile_button_hover_color: string;
  mobile_card_bg_color: string;
  mobile_card_border_color: string;
  mobile_input_bg_color: string;
  mobile_input_border_color: string;
  login_background_color: string;
  login_card_bg_color: string;
  login_text_color: string;
  login_input_bg_color: string;
  login_input_border_color: string;
  login_button_bg_color: string;
  login_button_text_color: string;
}

const defaultTheme: Omit<ThemeSettings, 'id'> = {
  desktop_primary_color: '#ff005c',
  desktop_secondary_color: '#000000',
  desktop_background_color: '#ffffff',
  desktop_foreground_color: '#0d0d0d',
  desktop_sidebar_bg_color: '#0d0d0d',
  desktop_sidebar_text_color: '#f2f2f2',
  desktop_sidebar_accent_color: '#1f1f1f',
  desktop_button_bg_color: '#ff005c',
  desktop_button_text_color: '#ffffff',
  desktop_button_hover_color: '#e60053',
  desktop_card_bg_color: '#ffffff',
  desktop_card_border_color: '#e5e5e5',
  desktop_input_bg_color: '#ffffff',
  desktop_input_border_color: '#e5e5e5',
  desktop_muted_color: '#f0f0f0',
  desktop_muted_foreground_color: '#666666',
  mobile_primary_color: '#ff005c',
  mobile_secondary_color: '#000000',
  mobile_background_color: '#ffffff',
  mobile_foreground_color: '#0d0d0d',
  mobile_header_bg_color: '#000000',
  mobile_header_text_color: '#ffffff',
  mobile_nav_bg_color: '#ffffff',
  mobile_nav_text_color: '#0d0d0d',
  mobile_nav_active_color: '#ff005c',
  mobile_button_bg_color: '#ff005c',
  mobile_button_text_color: '#ffffff',
  mobile_button_hover_color: '#e60053',
  mobile_card_bg_color: '#ffffff',
  mobile_card_border_color: '#e5e5e5',
  mobile_input_bg_color: '#ffffff',
  mobile_input_border_color: '#e5e5e5',
  login_background_color: '#0d0d0d',
  login_card_bg_color: '#1a1a1a',
  login_text_color: '#ffffff',
  login_input_bg_color: '#262626',
  login_input_border_color: '#404040',
  login_button_bg_color: '#ff005c',
  login_button_text_color: '#ffffff',
};

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <div 
          className="w-10 h-10 rounded-lg border-2 border-border overflow-hidden cursor-pointer relative"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm uppercase flex-1"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export function ThemeCustomizer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState<Omit<ThemeSettings, 'id'>>(defaultTheme);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const { data: themeSettings, isLoading } = useQuery({
    queryKey: ["theme-settings"],
    queryFn: async () => {
      // Try to get existing settings with limit 1 for faster query
      const { data, error } = await supabase
        .from("theme_settings")
        .select("*")
        .limit(1)
        .single();
      
      // If no settings exist, create default ones
      if (error && error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await supabase
          .from("theme_settings")
          .insert(defaultTheme)
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newData as ThemeSettings;
      }
      
      if (error) throw error;
      return data as ThemeSettings;
    },
    enabled: !!user,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  useEffect(() => {
    if (themeSettings) {
      const { id, ...rest } = themeSettings;
      setFormData(rest as Omit<ThemeSettings, 'id'>);
    }
  }, [themeSettings]);

  // Real-time preview effect
  const applyPreviewTheme = useCallback((data: Omit<ThemeSettings, 'id'>) => {
    const root = document.documentElement;
    const prefix = isMobile ? "mobile_" : "desktop_";

    // Get colors based on device type
    const primaryColor = data[`${prefix}primary_color` as keyof typeof data] as string || "#ff005c";
    const backgroundColor = data[`${prefix}background_color` as keyof typeof data] as string || "#ffffff";
    const foregroundColor = data[`${prefix}foreground_color` as keyof typeof data] as string || "#0d0d0d";
    const cardBgColor = data[`${prefix}card_bg_color` as keyof typeof data] as string || "#ffffff";
    const cardBorderColor = data[`${prefix}card_border_color` as keyof typeof data] as string || "#e5e5e5";
    const inputBorderColor = data[`${prefix}input_border_color` as keyof typeof data] as string || "#e5e5e5";

    // Desktop-specific
    const sidebarBgColor = data.desktop_sidebar_bg_color || "#0d0d0d";
    const sidebarTextColor = data.desktop_sidebar_text_color || "#f2f2f2";
    const sidebarAccentColor = data.desktop_sidebar_accent_color || "#1f1f1f";
    const mutedColor = data.desktop_muted_color || "#f0f0f0";
    const mutedForegroundColor = data.desktop_muted_foreground_color || "#666666";

    // Convert and apply colors
    const primaryHsl = hexToHsl(primaryColor);
    const backgroundHsl = hexToHsl(backgroundColor);
    const foregroundHsl = hexToHsl(foregroundColor);
    const cardBgHsl = hexToHsl(cardBgColor);
    const cardBorderHsl = hexToHsl(cardBorderColor);
    const inputBorderHsl = hexToHsl(inputBorderColor);
    const sidebarBgHsl = hexToHsl(sidebarBgColor);
    const sidebarTextHsl = hexToHsl(sidebarTextColor);
    const sidebarAccentHsl = hexToHsl(sidebarAccentColor);
    const mutedHsl = hexToHsl(mutedColor);
    const mutedForegroundHsl = hexToHsl(mutedForegroundColor);

    if (primaryHsl) {
      root.style.setProperty("--primary", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--accent", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--ring", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--sidebar-primary", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--sidebar-ring", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
    }

    if (backgroundHsl) {
      root.style.setProperty("--background", `${backgroundHsl.h} ${backgroundHsl.s}% ${backgroundHsl.l}%`);
    }

    if (foregroundHsl) {
      root.style.setProperty("--foreground", `${foregroundHsl.h} ${foregroundHsl.s}% ${foregroundHsl.l}%`);
    }

    if (cardBgHsl) {
      root.style.setProperty("--card", `${cardBgHsl.h} ${cardBgHsl.s}% ${cardBgHsl.l}%`);
      root.style.setProperty("--popover", `${cardBgHsl.h} ${cardBgHsl.s}% ${cardBgHsl.l}%`);
    }

    if (cardBorderHsl) {
      root.style.setProperty("--border", `${cardBorderHsl.h} ${cardBorderHsl.s}% ${cardBorderHsl.l}%`);
    }

    if (inputBorderHsl) {
      root.style.setProperty("--input", `${inputBorderHsl.h} ${inputBorderHsl.s}% ${inputBorderHsl.l}%`);
    }

    if (mutedHsl) {
      root.style.setProperty("--muted", `${mutedHsl.h} ${mutedHsl.s}% ${mutedHsl.l}%`);
      root.style.setProperty("--secondary", `${mutedHsl.h} ${mutedHsl.s}% ${mutedHsl.l}%`);
    }

    if (mutedForegroundHsl) {
      root.style.setProperty("--muted-foreground", `${mutedForegroundHsl.h} ${mutedForegroundHsl.s}% ${mutedForegroundHsl.l}%`);
    }

    // Sidebar
    if (sidebarBgHsl) {
      root.style.setProperty("--sidebar-background", `${sidebarBgHsl.h} ${sidebarBgHsl.s}% ${sidebarBgHsl.l}%`);
    }

    if (sidebarTextHsl) {
      root.style.setProperty("--sidebar-foreground", `${sidebarTextHsl.h} ${sidebarTextHsl.s}% ${sidebarTextHsl.l}%`);
    }

    if (sidebarAccentHsl) {
      root.style.setProperty("--sidebar-accent", `${sidebarAccentHsl.h} ${sidebarAccentHsl.s}% ${sidebarAccentHsl.l}%`);
    }
  }, [isMobile]);

  // Apply preview when formData changes
  useEffect(() => {
    if (previewEnabled) {
      applyPreviewTheme(formData);
    }
  }, [formData, previewEnabled, applyPreviewTheme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("theme_settings")
        .update(formData)
        .eq("id", themeSettings?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["theme-settings"] });
      queryClient.invalidateQueries({ queryKey: ["theme-settings-global"] });
      // Force immediate CSS update
      window.location.reload();
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao salvar tema", variant: "destructive" });
    },
  });

  const resetToDefault = () => {
    setFormData(defaultTheme);
    toast({ title: "Cores resetadas para o padrão. Clique em salvar para aplicar." });
  };

  const updateField = (key: keyof Omit<ThemeSettings, 'id'>, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Personalização de Cores</CardTitle>
                <CardDescription>Customize todas as cores do sistema</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={previewEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewEnabled(!previewEnabled)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              {previewEnabled && (
                <Badge variant="secondary" className="animate-pulse">
                  Ao vivo
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="desktop" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="desktop" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Mobile</span>
              </TabsTrigger>
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="desktop" className="space-y-6">
              {/* Primary Colors */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cores Principais</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorInput
                    label="Cor Primária"
                    value={formData.desktop_primary_color}
                    onChange={(v) => updateField('desktop_primary_color', v)}
                  />
                  <ColorInput
                    label="Cor Secundária"
                    value={formData.desktop_secondary_color}
                    onChange={(v) => updateField('desktop_secondary_color', v)}
                  />
                  <ColorInput
                    label="Fundo"
                    value={formData.desktop_background_color}
                    onChange={(v) => updateField('desktop_background_color', v)}
                  />
                  <ColorInput
                    label="Texto"
                    value={formData.desktop_foreground_color}
                    onChange={(v) => updateField('desktop_foreground_color', v)}
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Menu Lateral</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ColorInput
                    label="Fundo do Menu"
                    value={formData.desktop_sidebar_bg_color}
                    onChange={(v) => updateField('desktop_sidebar_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto do Menu"
                    value={formData.desktop_sidebar_text_color}
                    onChange={(v) => updateField('desktop_sidebar_text_color', v)}
                  />
                  <ColorInput
                    label="Destaque do Menu"
                    value={formData.desktop_sidebar_accent_color}
                    onChange={(v) => updateField('desktop_sidebar_accent_color', v)}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Botões</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ColorInput
                    label="Fundo do Botão"
                    value={formData.desktop_button_bg_color}
                    onChange={(v) => updateField('desktop_button_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto do Botão"
                    value={formData.desktop_button_text_color}
                    onChange={(v) => updateField('desktop_button_text_color', v)}
                  />
                  <ColorInput
                    label="Hover do Botão"
                    value={formData.desktop_button_hover_color}
                    onChange={(v) => updateField('desktop_button_hover_color', v)}
                  />
                </div>
              </div>

              {/* Cards & Inputs */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cards e Campos</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorInput
                    label="Fundo do Card"
                    value={formData.desktop_card_bg_color}
                    onChange={(v) => updateField('desktop_card_bg_color', v)}
                  />
                  <ColorInput
                    label="Borda do Card"
                    value={formData.desktop_card_border_color}
                    onChange={(v) => updateField('desktop_card_border_color', v)}
                  />
                  <ColorInput
                    label="Fundo do Input"
                    value={formData.desktop_input_bg_color}
                    onChange={(v) => updateField('desktop_input_bg_color', v)}
                  />
                  <ColorInput
                    label="Borda do Input"
                    value={formData.desktop_input_border_color}
                    onChange={(v) => updateField('desktop_input_border_color', v)}
                  />
                </div>
              </div>

              {/* Muted */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cores Secundárias</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ColorInput
                    label="Fundo Muted"
                    value={formData.desktop_muted_color}
                    onChange={(v) => updateField('desktop_muted_color', v)}
                  />
                  <ColorInput
                    label="Texto Muted"
                    value={formData.desktop_muted_foreground_color}
                    onChange={(v) => updateField('desktop_muted_foreground_color', v)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-6">
              {/* Primary Colors */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cores Principais</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorInput
                    label="Cor Primária"
                    value={formData.mobile_primary_color}
                    onChange={(v) => updateField('mobile_primary_color', v)}
                  />
                  <ColorInput
                    label="Cor Secundária"
                    value={formData.mobile_secondary_color}
                    onChange={(v) => updateField('mobile_secondary_color', v)}
                  />
                  <ColorInput
                    label="Fundo"
                    value={formData.mobile_background_color}
                    onChange={(v) => updateField('mobile_background_color', v)}
                  />
                  <ColorInput
                    label="Texto"
                    value={formData.mobile_foreground_color}
                    onChange={(v) => updateField('mobile_foreground_color', v)}
                  />
                </div>
              </div>

              {/* Header */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cabeçalho</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ColorInput
                    label="Fundo do Header"
                    value={formData.mobile_header_bg_color}
                    onChange={(v) => updateField('mobile_header_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto do Header"
                    value={formData.mobile_header_text_color}
                    onChange={(v) => updateField('mobile_header_text_color', v)}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Navegação Inferior</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ColorInput
                    label="Fundo da Nav"
                    value={formData.mobile_nav_bg_color}
                    onChange={(v) => updateField('mobile_nav_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto da Nav"
                    value={formData.mobile_nav_text_color}
                    onChange={(v) => updateField('mobile_nav_text_color', v)}
                  />
                  <ColorInput
                    label="Item Ativo"
                    value={formData.mobile_nav_active_color}
                    onChange={(v) => updateField('mobile_nav_active_color', v)}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Botões</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ColorInput
                    label="Fundo do Botão"
                    value={formData.mobile_button_bg_color}
                    onChange={(v) => updateField('mobile_button_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto do Botão"
                    value={formData.mobile_button_text_color}
                    onChange={(v) => updateField('mobile_button_text_color', v)}
                  />
                  <ColorInput
                    label="Hover do Botão"
                    value={formData.mobile_button_hover_color}
                    onChange={(v) => updateField('mobile_button_hover_color', v)}
                  />
                </div>
              </div>

              {/* Cards & Inputs */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Cards e Campos</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorInput
                    label="Fundo do Card"
                    value={formData.mobile_card_bg_color}
                    onChange={(v) => updateField('mobile_card_bg_color', v)}
                  />
                  <ColorInput
                    label="Borda do Card"
                    value={formData.mobile_card_border_color}
                    onChange={(v) => updateField('mobile_card_border_color', v)}
                  />
                  <ColorInput
                    label="Fundo do Input"
                    value={formData.mobile_input_bg_color}
                    onChange={(v) => updateField('mobile_input_bg_color', v)}
                  />
                  <ColorInput
                    label="Borda do Input"
                    value={formData.mobile_input_border_color}
                    onChange={(v) => updateField('mobile_input_border_color', v)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="login" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Página de Login</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ColorInput
                    label="Fundo da Página"
                    value={formData.login_background_color}
                    onChange={(v) => updateField('login_background_color', v)}
                  />
                  <ColorInput
                    label="Fundo do Card"
                    value={formData.login_card_bg_color}
                    onChange={(v) => updateField('login_card_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto"
                    value={formData.login_text_color}
                    onChange={(v) => updateField('login_text_color', v)}
                  />
                  <ColorInput
                    label="Fundo do Input"
                    value={formData.login_input_bg_color}
                    onChange={(v) => updateField('login_input_bg_color', v)}
                  />
                  <ColorInput
                    label="Borda do Input"
                    value={formData.login_input_border_color}
                    onChange={(v) => updateField('login_input_border_color', v)}
                  />
                  <ColorInput
                    label="Fundo do Botão"
                    value={formData.login_button_bg_color}
                    onChange={(v) => updateField('login_button_bg_color', v)}
                  />
                  <ColorInput
                    label="Texto do Botão"
                    value={formData.login_button_text_color}
                    onChange={(v) => updateField('login_button_text_color', v)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={resetToDefault}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Resetar Padrão
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Tema
        </Button>
      </div>
    </div>
  );
}