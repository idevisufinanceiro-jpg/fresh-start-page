import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { QuotesList } from "@/components/quotes/QuotesList";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { QuotePreview } from "@/components/quotes/QuotePreview";
import { ConvertQuoteToSale } from "@/components/sales/ConvertQuoteToSale";
import { generateQuotePDF } from "@/lib/generateQuotePDF";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Quote = Tables<"quotes"> & {
  customers?: Tables<"customers"> | null;
};

type View = "list" | "form" | "preview";

export default function Quotes() {
  const [view, setView] = useState<View>("list");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*")
  });

  const handleNewQuote = () => {
    setSelectedQuote(null);
    setView("form");
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setView("form");
  };

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setView("preview");
  };

  const handleGeneratePDF = async (quote: Quote) => {
    try {
      const { data: items, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("created_at");

      if (error) throw error;

      await generateQuotePDF(quote, items || [], companySettings);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const handleConvertToSale = (quote: Quote) => {
    setQuoteToConvert(quote);
    setConvertDialogOpen(true);
  };

  const handleBack = () => {
    setView("list");
    setSelectedQuote(null);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div className="overflow-hidden">
        <h1 className="text-2xl md:text-3xl font-bold truncate">Orçamentos</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">Gerencie seus orçamentos e propostas</p>
      </div>

      {view === "list" && (
        <QuotesList
          onNewQuote={handleNewQuote}
          onEditQuote={handleEditQuote}
          onViewQuote={handleViewQuote}
          onGeneratePDF={handleGeneratePDF}
          onConvertToSale={handleConvertToSale}
        />
      )}

      {view === "form" && (
        <QuoteForm
          quote={selectedQuote}
          onBack={handleBack}
          onSuccess={handleBack}
        />
      )}

      {view === "preview" && selectedQuote && (
        <QuotePreview
          quote={selectedQuote}
          onBack={handleBack}
          onEdit={() => setView("form")}
          onGeneratePDF={() => handleGeneratePDF(selectedQuote)}
        />
      )}

      <ConvertQuoteToSale
        quote={quoteToConvert}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onSuccess={() => setQuoteToConvert(null)}
      />
    </div>
  );
}
