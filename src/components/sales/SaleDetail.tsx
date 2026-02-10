import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSharedCompanySettings } from "@/lib/companySettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, Clock, Loader2, User, Calendar, FileText, Download, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateSalePDF } from "@/lib/generateSalePDF";
import { toast } from "@/hooks/use-toast";

interface SaleDetailProps {
  saleId: string;
  onBack: () => void;
  onEdit?: (saleId: string) => void;
}

export function SaleDetail({ saleId, onBack, onEdit }: SaleDetailProps) {

  const { data: sale, isLoading: loadingSale } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`*, customers(*)`)
        .eq("id", saleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["sale-items", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", saleId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => fetchSharedCompanySettings("*")
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-500/50"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "partial":
        return <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-500/50">Parcial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleGeneratePDF = async () => {
    if (!sale || !items) return;
    try {
      await generateSalePDF(sale, items, companySettings);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  if (loadingSale || loadingItems) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sale) {
    return <div>Venda não encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{sale.title}</h2>
          <p className="text-muted-foreground">{sale.sale_number}</p>
        </div>
        <Button onClick={handleGeneratePDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Baixar PDF</span>
        </Button>
        {onEdit && (
          <Button onClick={() => onEdit(saleId)} variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        )}
        {getStatusBadge(sale.payment_status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sale Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informações da Venda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número:</span>
              <span className="font-mono">{sale.sale_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span>{format(new Date(sale.sold_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            {sale.delivery_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega:</span>
                <span>{format(new Date(sale.delivery_date), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagamento:</span>
              <span className="capitalize">{sale.payment_method || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sale.customers ? (
              <div className="space-y-2">
                <p className="font-medium">{sale.customers.name}</p>
                {sale.customers.email && (
                  <p className="text-sm text-muted-foreground">{sale.customers.email}</p>
                )}
                {sale.customers.phone && (
                  <p className="text-sm text-muted-foreground">{sale.customers.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum cliente vinculado</p>
            )}
          </CardContent>
        </Card>

        {/* Values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span className="text-green-600">{formatCurrency(sale.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Itens da Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Valor Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {sale.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{sale.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
