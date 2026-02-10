import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Send, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Quote = Tables<"quotes"> & {
  customers?: Tables<"customers"> | null;
};

interface QuotePreviewProps {
  quote: Quote;
  onBack: () => void;
  onEdit: () => void;
  onGeneratePDF: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  approved: "bg-accent/10 text-accent",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  cancelled: "Cancelado",
};

const categoryLabels: Record<string, string> = {
  graphic_design: "Design Gráfico",
  visual_identity: "Identidade Visual",
  institutional_video: "Vídeo Institucional",
  event_coverage: "Cobertura de Eventos",
  social_media: "Social Media",
  photography: "Fotografia",
  motion_design: "Motion Design",
  other: "Outros",
};

export function QuotePreview({ quote, onBack, onEdit, onGeneratePDF }: QuotePreviewProps) {
  const { data: items } = useQuery({
    queryKey: ["quote-items", quote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*")
  });

  const sendWhatsApp = () => {
    const phone = quote.customers?.phone?.replace(/\D/g, "");
    if (!phone) {
      toast({ title: "Cliente não possui telefone cadastrado", variant: "destructive" });
      return;
    }

    const message = encodeURIComponent(
      `Olá ${quote.customers?.name}!\n\n` +
      `Segue o orçamento ${quote.quote_number}:\n` +
      `${quote.title}\n\n` +
      `Valor: R$ ${quote.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Aguardamos seu retorno!`
    );
    
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h2 className="text-2xl font-bold">Orçamento {quote.quote_number}</h2>
          <Badge className={statusColors[quote.status || "draft"]}>
            {statusLabels[quote.status || "draft"]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="outline" onClick={onGeneratePDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={sendWhatsApp} className="bg-green-600 hover:bg-green-700">
            <Send className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b">
            <div>
              {companySettings?.logo_url && (
                <img 
                  src={companySettings.logo_url} 
                  alt="Logo" 
                  className="h-16 mb-4"
                />
              )}
              <h3 className="text-xl font-bold text-primary">
                {companySettings?.company_name || "Minha Empresa"}
              </h3>
              {companySettings?.cnpj_cpf && (
                <p className="text-sm text-muted-foreground">CNPJ/CPF: {companySettings.cnpj_cpf}</p>
              )}
              {companySettings?.address && (
                <p className="text-sm text-muted-foreground">{companySettings.address}</p>
              )}
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                {companySettings?.phone && <span>Tel: {companySettings.phone}</span>}
                {companySettings?.email && <span>Email: {companySettings.email}</span>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-primary mb-2">ORÇAMENTO</h2>
              <p className="text-lg font-medium">{quote.quote_number}</p>
              <p className="text-sm text-muted-foreground">
                Data: {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              {quote.valid_until && (
                <p className="text-sm text-muted-foreground">
                  Válido até: {format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>

          {/* Client Info */}
          {quote.customers && (
            <div className="mb-8 p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">Cliente</h4>
              <p className="font-medium">{quote.customers.name}</p>
              {quote.customers.company && (
                <p className="text-sm text-muted-foreground">{quote.customers.company}</p>
              )}
              {quote.customers.cpf_cnpj && (
                <p className="text-sm text-muted-foreground">CPF/CNPJ: {quote.customers.cpf_cnpj}</p>
              )}
              <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                {quote.customers.email && <span>{quote.customers.email}</span>}
                {quote.customers.phone && <span>{quote.customers.phone}</span>}
              </div>
            </div>
          )}

          {/* Quote Info */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2">{quote.title}</h3>
            <Badge variant="outline">{categoryLabels[quote.category || "other"]}</Badge>
            {quote.description && (
              <p className="mt-4 text-muted-foreground">{quote.description}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-semibold">Descrição</th>
                  <th className="text-center py-3 font-semibold w-24">Qtd</th>
                  <th className="text-right py-3 font-semibold w-32">Valor Unit.</th>
                  <th className="text-right py-3 font-semibold w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((item) => (
                  <tr key={item.id} className="border-b border-muted">
                    <td className="py-3">{item.description}</td>
                    <td className="text-center py-3">{item.quantity}</td>
                    <td className="text-right py-3">
                      R$ {Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3">
                      R$ {Number(item.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {Number(quote.subtotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {quote.discount && quote.discount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>- R$ {Number(quote.discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">
                  R$ {Number(quote.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">Observações</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Footer */}
          {companySettings?.quote_footer_notes && (
            <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
              <p>{companySettings.quote_footer_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
