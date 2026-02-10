import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  FileText, 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Download,
  Send,
  CheckCircle,
  XCircle,
  Briefcase,
  ShoppingBag,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Quote = Tables<"quotes"> & {
  customers?: Tables<"customers"> | null;
};

interface QuotesListProps {
  onNewQuote: () => void;
  onEditQuote: (quote: Quote) => void;
  onViewQuote: (quote: Quote) => void;
  onGeneratePDF: (quote: Quote) => void;
  onConvertToService?: (quote: Quote) => void;
  onConvertToSale?: (quote: Quote) => void;
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

export function QuotesList({ onNewQuote, onEditQuote, onViewQuote, onGeneratePDF, onConvertToService, onConvertToSale }: QuotesListProps) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(*)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status: status as "draft" | "sent" | "approved" | "cancelled" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("quote_items").delete().eq("quote_id", id);
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Orçamento excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir orçamento", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (quote: Quote) => {
      // Get quote items
      const { data: items } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id);

      // Get new quote number
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not found");

      const { data: quoteNumber } = await supabase.rpc("generate_quote_number", { _user_id: user.user.id });

      // Create new quote
      const { data: newQuote, error } = await supabase
        .from("quotes")
        .insert({
          user_id: user.user.id,
          quote_number: quoteNumber,
          title: `${quote.title} (Cópia)`,
          description: quote.description,
          customer_id: quote.customer_id,
          category: quote.category,
          discount: quote.discount,
          notes: quote.notes,
          subtotal: quote.subtotal,
          total: quote.total,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Copy items
      if (items && items.length > 0) {
        await supabase.from("quote_items").insert(
          items.map((item) => ({
            quote_id: newQuote.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Orçamento duplicado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao duplicar orçamento", variant: "destructive" });
    },
  });

  const filteredQuotes = quotes?.filter(quote => 
    quote.title.toLowerCase().includes(search.toLowerCase()) ||
    quote.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    quote.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const sendWhatsApp = (quote: Quote) => {
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
    <Card className="shadow-card">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Orçamentos
        </CardTitle>
        <Button onClick={onNewQuote} className="bg-gradient-primary w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar orçamentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredQuotes?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum orçamento encontrado</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3 overflow-x-hidden">
              {filteredQuotes?.map((quote) => (
                <div key={quote.id} className="border rounded-lg p-4 space-y-3 overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-mono text-xs text-muted-foreground truncate">{quote.quote_number}</p>
                      <p className="font-medium truncate">{quote.customers?.name || "-"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewQuote(quote)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditQuote(quote)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGeneratePDF(quote)}>
                          <Download className="h-4 w-4 mr-2" />
                          Baixar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => sendWhatsApp(quote)}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar WhatsApp
                        </DropdownMenuItem>
                        {quote.status !== "sent" && (
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "sent" })}>
                            <Send className="h-4 w-4 mr-2" />
                            Marcar como Enviado
                          </DropdownMenuItem>
                        )}
                        {quote.status !== "approved" && (
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "approved" })}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar como Aprovado
                          </DropdownMenuItem>
                        )}
                        {quote.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "cancelled" })}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </DropdownMenuItem>
                        )}
                        {quote.status !== "cancelled" && onConvertToSale && (
                          <DropdownMenuItem onClick={() => onConvertToSale(quote)}>
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            Converter em Venda
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(quote)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(quote.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[quote.status || "draft"]}>
                        {statusLabels[quote.status || "draft"]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="font-semibold">
                      R$ {quote.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes?.map((quote) => (
                    <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{quote.quote_number}</TableCell>
                      <TableCell>{quote.customers?.name || "-"}</TableCell>
                      <TableCell>
                        R$ {quote.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[quote.status || "draft"]}>
                          {statusLabels[quote.status || "draft"]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewQuote(quote)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditQuote(quote)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onGeneratePDF(quote)}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendWhatsApp(quote)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar WhatsApp
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "sent" })}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Marcar como Enviado
                              </DropdownMenuItem>
                            )}
                            {quote.status === "sent" && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "approved" })}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Marcar como Aprovado
                                </DropdownMenuItem>
                                {onConvertToService && (
                                  <DropdownMenuItem onClick={() => onConvertToService(quote)}>
                                    <Briefcase className="h-4 w-4 mr-2" />
                                    Converter em Serviço
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {quote.status === "approved" && onConvertToService && (
                              <DropdownMenuItem onClick={() => onConvertToService(quote)}>
                                <Briefcase className="h-4 w-4 mr-2" />
                                Converter em Serviço
                              </DropdownMenuItem>
                            )}
                            {quote.status !== "cancelled" && onConvertToSale && (
                              <DropdownMenuItem onClick={() => onConvertToSale(quote)}>
                                <ShoppingBag className="h-4 w-4 mr-2" />
                                Converter em Venda
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(quote)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            {quote.status !== "cancelled" && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "cancelled" })}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => deleteMutation.mutate(quote.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
