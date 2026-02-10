import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SalesList } from "@/components/sales/SalesList";
import { SaleDetail } from "@/components/sales/SaleDetail";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type View = "list" | "detail";

interface Sale {
  id: string;
  sale_number: string;
  title: string;
  total: number;
  payment_status: string;
  sold_at: string;
  customer_id: string | null;
  customers?: { name: string } | null;
}

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>("list");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<any>(null);

  const editSaleId = searchParams.get("edit");
  const viewSaleId = searchParams.get("view");

  // Fetch sale to edit if edit param is present
  const { data: saleFromUrl } = useQuery({
    queryKey: ["sale-for-edit", editSaleId],
    queryFn: async () => {
      if (!editSaleId) return null;
      const { data, error } = await supabase
        .from("sales")
        .select(`*, customers(name), sale_items(*)`)
        .eq("id", editSaleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!editSaleId,
  });

  // Fetch sale to view if view param is present
  const { data: saleToView } = useQuery({
    queryKey: ["sale-for-view", viewSaleId],
    queryFn: async () => {
      if (!viewSaleId) return null;
      const { data, error } = await supabase
        .from("sales")
        .select(`*, customers(name)`)
        .eq("id", viewSaleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!viewSaleId,
  });

  useEffect(() => {
    if (saleFromUrl && editSaleId) {
      setSaleToEdit(saleFromUrl);
      setEditDialogOpen(true);
      setSearchParams({});
    }
  }, [saleFromUrl, editSaleId, setSearchParams]);

  useEffect(() => {
    if (saleToView && viewSaleId) {
      setSelectedSale(saleToView as Sale);
      setView("detail");
      setSearchParams({});
    }
  }, [saleToView, viewSaleId, setSearchParams]);

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
    setSelectedSale(null);
  };

  const handleEditFromDetail = async (saleId: string) => {
    const { data, error } = await supabase
      .from("sales")
      .select(`*, customers(name), sale_items(*)`)
      .eq("id", saleId)
      .single();
    if (!error && data) {
      setSaleToEdit(data);
      setEditDialogOpen(true);
    }
  };

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setSaleToEdit(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden w-full max-w-full">
      {view === "list" && <SalesList onViewSale={handleViewSale} />}

      {view === "detail" && selectedSale && (
        <SaleDetail saleId={selectedSale.id} onBack={handleBack} onEdit={handleEditFromDetail} />
      )}

      <SaleFormDialog 
        open={editDialogOpen} 
        onOpenChange={handleEditDialogClose} 
        sale={saleToEdit}
        onSuccess={() => setEditDialogOpen(false)}
      />
    </div>
  );
}
