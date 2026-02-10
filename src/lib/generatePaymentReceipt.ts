import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReceiptData {
  receiptNumber?: number;
  securityCode?: string;
  description: string;
  customerName: string;
  customerCpfCnpj?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  customerState?: string;
  customerCep?: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  dueDate?: string;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyCnpj?: string;
  logoUrl?: string;
  receiptLogoUrl?: string;
  receivedByName?: string;
}

async function loadImageAsBase64(url: string, maxWidth = 300, quality = 0.85): Promise<{ base64: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    // Skip ICO files - jsPDF doesn't support them
    if (url.toLowerCase().endsWith('.ico')) {
      return null;
    }
    
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Create an image element to resize
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Create canvas for resizing and compression
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG for better compression
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64, format: 'JPEG' });
      };
      
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePaymentReceipt(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;
  const TEXT_COLOR: [number, number, number] = [0, 0, 0];

  // Load receipt logo - prioritize receiptLogoUrl, fallback to logoUrl
  let logoData: { base64: string; format: 'PNG' | 'JPEG' } | null = null;
  const logoToUse = data.receiptLogoUrl || data.logoUrl;
  if (logoToUse) {
    logoData = await loadImageAsBase64(logoToUse);
  }

  // Draw outer border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);

  let yPos = margin + 8;

  // === HEADER SECTION ===
  // Logo on the left - maintaining original aspect ratio (wide logo)
  if (logoData) {
    try {
      // Logo with proper aspect ratio (approximately 4:1 width:height for this wide logo)
      doc.addImage(logoData.base64, logoData.format, margin + 5, yPos, 60, 15);
    } catch (e) {
      console.warn('Failed to add logo to receipt:', e);
    }
  }

  // Center: "Recibo" title and dates
  const centerX = pageWidth / 2;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("Recibo", centerX, yPos + 3);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const formattedEmissionDate = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  const formattedDueDate = data.dueDate ? format(new Date(data.dueDate), "dd/MM/yyyy", { locale: ptBR }) : "-";
  const formattedPaidDate = format(new Date(data.paidAt), "dd/MM/yyyy", { locale: ptBR });

  doc.text(`Data Emissão: ${formattedEmissionDate}`, centerX, yPos + 10);
  doc.text(`Data de Vencimento: ${formattedDueDate}`, centerX, yPos + 15);
  doc.text(`Data de Pagamento: ${formattedPaidDate}`, centerX, yPos + 20);

  // Right: Receipt number
  const rightX = pageWidth - margin - 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Nº RECIBO: ${data.receiptNumber || 1}`, rightX, yPos + 3, { align: "right" });

  yPos += 30;

  // === CLIENT DATA BOX ===
  const clientBoxX = margin + 5;
  const clientBoxWidth = contentWidth - 10;
  const clientBoxHeight = 32;
  
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(clientBoxX, yPos, clientBoxWidth, clientBoxHeight);

  // Draw horizontal lines for rows
  const rowHeight = 10;
  doc.setLineWidth(0.3);
  doc.line(clientBoxX, yPos + rowHeight, clientBoxX + clientBoxWidth, yPos + rowHeight);
  doc.line(clientBoxX, yPos + rowHeight * 2, clientBoxX + clientBoxWidth, yPos + rowHeight * 2);

  // Draw vertical line for two columns
  const colDivider = clientBoxX + clientBoxWidth * 0.55;
  doc.line(colDivider, yPos, colDivider, yPos + clientBoxHeight);

  doc.setFontSize(9);
  
  // Row 1: Nome | CNPJ/CPF
  doc.setFont("helvetica", "bold");
  doc.text("Nome:", clientBoxX + 3, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.2);
  doc.line(clientBoxX + 22, yPos + 8, colDivider - 5, yPos + 8);
  const customerNameTruncated = (data.customerName || "").substring(0, 40);
  doc.text(customerNameTruncated, clientBoxX + 23, yPos + 6);
  
  doc.setFont("helvetica", "bold");
  doc.text("CNPJ/CPF:", colDivider + 3, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.line(colDivider + 28, yPos + 8, clientBoxX + clientBoxWidth - 5, yPos + 8);
  doc.text(data.customerCpfCnpj || "", colDivider + 29, yPos + 6);

  // Row 2: Endereço | CEP
  doc.setFont("helvetica", "bold");
  doc.text("Endereço:", clientBoxX + 3, yPos + rowHeight + 7);
  doc.setFont("helvetica", "normal");
  doc.line(clientBoxX + 28, yPos + rowHeight + 8, colDivider - 5, yPos + rowHeight + 8);
  const addressTruncated = (data.customerAddress || "").substring(0, 35);
  doc.text(addressTruncated, clientBoxX + 29, yPos + rowHeight + 6);
  
  doc.setFont("helvetica", "bold");
  doc.text("CEP:", colDivider + 3, yPos + rowHeight + 7);
  doc.setFont("helvetica", "normal");
  doc.line(colDivider + 15, yPos + rowHeight + 8, clientBoxX + clientBoxWidth - 5, yPos + rowHeight + 8);
  doc.text(data.customerCep || "", colDivider + 16, yPos + rowHeight + 6);

  // Row 3: Cidade | Estado
  doc.setFont("helvetica", "bold");
  doc.text("Cidade:", clientBoxX + 3, yPos + rowHeight * 2 + 7);
  doc.setFont("helvetica", "normal");
  doc.line(clientBoxX + 22, yPos + rowHeight * 2 + 8, colDivider - 5, yPos + rowHeight * 2 + 8);
  doc.text(data.customerCity || "", clientBoxX + 23, yPos + rowHeight * 2 + 6);
  
  doc.setFont("helvetica", "bold");
  doc.text("Estado:", colDivider + 3, yPos + rowHeight * 2 + 7);
  doc.setFont("helvetica", "normal");
  doc.line(colDivider + 22, yPos + rowHeight * 2 + 8, clientBoxX + clientBoxWidth - 5, yPos + rowHeight * 2 + 8);
  doc.text(data.customerState || "", colDivider + 23, yPos + rowHeight * 2 + 6);

  yPos += clientBoxHeight + 5;

  // === DESCRIÇÃO BOX ===
  const descBoxHeight = 25;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(clientBoxX, yPos, clientBoxWidth, descBoxHeight);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Descrição:", clientBoxX + 3, yPos + 8);
  
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(data.description || "", clientBoxWidth - 30);
  doc.text(descLines.slice(0, 3), clientBoxX + 30, yPos + 8);

  yPos += descBoxHeight + 5;

  // === VALOR TOTAL BOX ===
  const valorBoxHeight = 15;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(clientBoxX, yPos, clientBoxWidth, valorBoxHeight);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const formattedAmount = data.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  doc.text("Valor Total:", clientBoxX + 3, yPos + 10);
  doc.text(formattedAmount, clientBoxX + 35, yPos + 10);

  yPos += valorBoxHeight + 5;

  // === SIGNATURE BOX ===
  const sigBoxHeight = 20;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(clientBoxX, yPos, clientBoxWidth, sigBoxHeight);

  // "Recebido por:" on left with name filled
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Recebido por:", clientBoxX + 3, yPos + 12);
  
  // Name of the person who processed the payment
  doc.setFont("helvetica", "normal");
  doc.text(data.receivedByName || "", clientBoxX + 35, yPos + 12);
  
  // Signature line below name
  doc.setLineWidth(0.3);
  doc.line(clientBoxX + 35, yPos + 14, clientBoxX + clientBoxWidth * 0.5, yPos + 14);

  // Date on right - filled with paid date
  doc.setFont("helvetica", "bold");
  doc.text("Data:", clientBoxX + clientBoxWidth * 0.6, yPos + 12);
  doc.setFont("helvetica", "normal");
  doc.text(formattedPaidDate, clientBoxX + clientBoxWidth * 0.68, yPos + 12);

  // Save
  const fileName = `recibo_${data.customerName?.replace(/\s+/g, "_") || "pagamento"}_${format(new Date(), "ddMMyyyy")}.pdf`;
  doc.save(fileName);
}
