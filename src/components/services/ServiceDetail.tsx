import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tables } from "@/integrations/supabase/types";
import { StageManager } from "./StageManager";
import { AttachmentManager } from "./AttachmentManager";
import { ArrowLeft, Pencil, Calendar, User, DollarSign, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Service = Tables<"services"> & {
  customers?: Tables<"customers"> | null;
};

interface ServiceDetailProps {
  service: Service;
  onBack: () => void;
  onEdit: () => void;
}

const categoryLabels: Record<string, string> = {
  wedding: "Casamento",
  corporate: "Corporativo",
  birthday: "Aniversário",
  graduation: "Formatura",
  baptism: "Batizado",
  other: "Outro",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
};

export function ServiceDetail({ service, onBack, onEdit }: ServiceDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{service.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusConfig[service.status || "scheduled"].variant}>
                {statusConfig[service.status || "scheduled"].label}
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{categoryLabels[service.category || "other"]}</span>
            </div>
          </div>
        </div>
        <Button onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{service.customers?.name || "Não informado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="font-medium">
                      {service.total_value
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.total_value)
                        : "Não informado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Início</p>
                    <p className="font-medium">
                      {service.start_date
                        ? format(new Date(service.start_date), "dd/MM/yyyy", { locale: ptBR })
                        : "Não informado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Entrega</p>
                    <p className="font-medium">
                      {service.due_date
                        ? format(new Date(service.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "Não informado"}
                    </p>
                  </div>
                </div>
              </div>

              {service.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                    <p className="whitespace-pre-wrap">{service.description}</p>
                  </div>
                </>
              )}

              {service.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="whitespace-pre-wrap">{service.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <StageManager serviceId={service.id} />
        </div>

        <div>
          <AttachmentManager serviceId={service.id} />
        </div>
      </div>
    </div>
  );
}
