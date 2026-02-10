import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Smartphone, CreditCard, Banknote, ArrowRightLeft } from "lucide-react";

interface PartialPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  description: string;
  totalAmount: number;
  remainingAmount: number;
  onConfirm: (entryId: string, paidAmount: number, paymentMethod: string, isFullPayment: boolean) => void;
}

const paymentMethods = [
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "card", label: "Cartão", icon: CreditCard },
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "transfer", label: "Transferência", icon: ArrowRightLeft },
];

export function PartialPaymentDialog({
  open,
  onOpenChange,
  entryId,
  description,
  totalAmount,
  remainingAmount,
  onConfirm,
}: PartialPaymentDialogProps) {
  const [paidAmount, setPaidAmount] = useState(remainingAmount);
  const [paymentMethod, setPaymentMethod] = useState("pix");

  // Reset paidAmount when dialog opens with new remainingAmount
  useEffect(() => {
    if (open) {
      setPaidAmount(remainingAmount);
    }
  }, [open, remainingAmount]);

  const handleConfirm = () => {
    if (paidAmount <= 0) return;
    if (paidAmount > remainingAmount) return;
    
    const isFullPayment = paidAmount >= remainingAmount;
    onConfirm(entryId, paidAmount, paymentMethod, isFullPayment);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const newRemaining = Math.max(0, remainingAmount - paidAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar Baixa em Pagamento</DialogTitle>
          <DialogDescription>
            Registre um pagamento parcial ou total para este lançamento
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Valor total: {formatCurrency(totalAmount)}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Valor a Pagar Agora</Label>
              <CurrencyInput
                value={paidAmount}
                onChange={setPaidAmount}
              />
              <p className="text-xs text-muted-foreground">
                Restante a pagar: {formatCurrency(remainingAmount)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagando agora:</span>
                <span className="font-medium text-accent">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Restará:</span>
                <span className={newRemaining > 0 ? "font-medium text-amber-600" : "font-medium text-accent"}>
                  {formatCurrency(newRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={paidAmount <= 0 || paidAmount > remainingAmount}
          >
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
