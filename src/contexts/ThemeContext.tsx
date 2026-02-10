import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { useAuth } from "./AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface ThemeContextType {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  companyName: string | null;
  refreshTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: "#ff005c",
  secondaryColor: "#000000",
  logoUrl: null,
  companyName: null,
  refreshTheme: () => {},
});

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch company settings - shared for all users
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*"),
    enabled: !!user,
  });

  // Fetch theme settings
  const { data: themeSettings, refetch: refetchTheme } = useQuery({
    queryKey: ["theme-settings-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("theme_settings")
        .select("*")
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const refreshTheme = useCallback(() => {
    refetchTheme();
    queryClient.invalidateQueries({ queryKey: ["theme-settings-global"] });
  }, [refetchTheme, queryClient]);

  // Apply theme settings
  useEffect(() => {
    if (!themeSettings) return;

    const root = document.documentElement;
    const prefix = isMobile ? "mobile_" : "desktop_";

    // Get colors based on device type
    const primaryColor = themeSettings[`${prefix}primary_color` as keyof typeof themeSettings] as string || "#ff005c";
    const secondaryColor = themeSettings[`${prefix}secondary_color` as keyof typeof themeSettings] as string || "#000000";
    const backgroundColor = themeSettings[`${prefix}background_color` as keyof typeof themeSettings] as string || "#ffffff";
    const foregroundColor = themeSettings[`${prefix}foreground_color` as keyof typeof themeSettings] as string || "#0d0d0d";
    const buttonBgColor = themeSettings[`${prefix}button_bg_color` as keyof typeof themeSettings] as string || "#ff005c";
    const buttonTextColor = themeSettings[`${prefix}button_text_color` as keyof typeof themeSettings] as string || "#ffffff";
    const buttonHoverColor = themeSettings[`${prefix}button_hover_color` as keyof typeof themeSettings] as string || "#e60053";
    const cardBgColor = themeSettings[`${prefix}card_bg_color` as keyof typeof themeSettings] as string || "#ffffff";
    const cardBorderColor = themeSettings[`${prefix}card_border_color` as keyof typeof themeSettings] as string || "#e5e5e5";
    const inputBgColor = themeSettings[`${prefix}input_bg_color` as keyof typeof themeSettings] as string || "#ffffff";
    const inputBorderColor = themeSettings[`${prefix}input_border_color` as keyof typeof themeSettings] as string || "#e5e5e5";

    // Desktop-specific
    const sidebarBgColor = themeSettings.desktop_sidebar_bg_color || "#0d0d0d";
    const sidebarTextColor = themeSettings.desktop_sidebar_text_color || "#f2f2f2";
    const sidebarAccentColor = themeSettings.desktop_sidebar_accent_color || "#1f1f1f";
    const mutedColor = themeSettings.desktop_muted_color || "#f0f0f0";
    const mutedForegroundColor = themeSettings.desktop_muted_foreground_color || "#666666";

    // Mobile-specific
    const headerBgColor = themeSettings.mobile_header_bg_color || "#000000";
    const headerTextColor = themeSettings.mobile_header_text_color || "#ffffff";
    const navBgColor = themeSettings.mobile_nav_bg_color || "#ffffff";
    const navTextColor = themeSettings.mobile_nav_text_color || "#0d0d0d";
    const navActiveColor = themeSettings.mobile_nav_active_color || "#ff005c";

    // Convert and apply colors
    const primaryHsl = hexToHsl(primaryColor);
    const secondaryHsl = hexToHsl(secondaryColor);
    const backgroundHsl = hexToHsl(backgroundColor);
    const foregroundHsl = hexToHsl(foregroundColor);
    const buttonBgHsl = hexToHsl(buttonBgColor);
    const cardBgHsl = hexToHsl(cardBgColor);
    const cardBorderHsl = hexToHsl(cardBorderColor);
    const inputBgHsl = hexToHsl(inputBgColor);
    const inputBorderHsl = hexToHsl(inputBorderColor);
    const sidebarBgHsl = hexToHsl(sidebarBgColor);
    const sidebarTextHsl = hexToHsl(sidebarTextColor);
    const sidebarAccentHsl = hexToHsl(sidebarAccentColor);
    const mutedHsl = hexToHsl(mutedColor);
    const mutedForegroundHsl = hexToHsl(mutedForegroundColor);
    const headerBgHsl = hexToHsl(headerBgColor);
    const headerTextHsl = hexToHsl(headerTextColor);
    const navBgHsl = hexToHsl(navBgColor);
    const navTextHsl = hexToHsl(navTextColor);
    const navActiveHsl = hexToHsl(navActiveColor);

    if (primaryHsl) {
      root.style.setProperty("--primary", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--accent", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--ring", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
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

    if (primaryHsl) {
      root.style.setProperty("--sidebar-primary", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
      root.style.setProperty("--sidebar-ring", `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
    }

    // Update favicon dynamically with company logo
    if (companySettings?.logo_url) {
      const existingFavicon = document.querySelector("link[rel='icon']");
      if (existingFavicon) {
        existingFavicon.setAttribute("href", companySettings.logo_url);
      } else {
        const newFavicon = document.createElement("link");
        newFavicon.rel = "icon";
        newFavicon.href = companySettings.logo_url;
        document.head.appendChild(newFavicon);
      }
    }
  }, [themeSettings, isMobile, companySettings]);

  return (
    <ThemeContext.Provider
      value={{
        primaryColor: companySettings?.primary_color || "#ff005c",
        secondaryColor: companySettings?.secondary_color || "#000000",
        logoUrl: companySettings?.logo_url || null,
        companyName: companySettings?.company_name || null,
        refreshTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
