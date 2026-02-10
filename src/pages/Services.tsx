import { useState} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceTypesList } from "@/components/services/ServiceTypesList";
import { Package, Briefcase } from "lucide-react";

export default function Services() {
  return (
    <div className="space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      <div className="overflow-hidden">
        <h1 className="text-2xl md:text-3xl font-bold truncate">Serviços</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">Cadastre os tipos de serviços que você oferece</p>
      </div>

      <Tabs defaultValue="types" className="space-y-6">
        <TabsList>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Tipos de Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <ServiceTypesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
