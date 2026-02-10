import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Sale = Tables<"sales"> & {
  customers?: Tables<"customers"> | null;
};
type SaleItem = Tables<"sale_items">;
type CompanySettings = Tables<"company_settings">;

interface InstallmentData {
  number: number;
  amount: number;
  dueDate: string;
  paymentMethod: string;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  open: "Em Aberto",
};

const paymentStatusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  partial: "Parcial",
};

const TEXT_COLOR: [number, number, number] = [0, 0, 0];

async function loadImageAsBase64(url: string, maxWidth = 300, quality = 0.85, borderRadius = 0): Promise<{ base64: string; format: 'PNG' | 'JPEG' } | null> {
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
        
        // Apply rounded corners if specified
        if (borderRadius > 0) {
          const radius = Math.min(borderRadius, width / 2, height / 2);
          ctx.beginPath();
          ctx.moveTo(radius, 0);
          ctx.lineTo(width - radius, 0);
          ctx.quadraticCurveTo(width, 0, width, radius);
          ctx.lineTo(width, height - radius);
          ctx.quadraticCurveTo(width, height, width - radius, height);
          ctx.lineTo(radius, height);
          ctx.quadraticCurveTo(0, height, 0, height - radius);
          ctx.lineTo(0, radius);
          ctx.quadraticCurveTo(0, 0, radius, 0);
          ctx.closePath();
          ctx.clip();
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Use PNG to preserve transparency for rounded corners
        const format = borderRadius > 0 ? 'PNG' : 'JPEG';
        const base64 = canvas.toDataURL(borderRadius > 0 ? 'image/png' : 'image/jpeg', quality);
        resolve({ base64, format });
      };
      
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateSalePDF(
  sale: Sale,
  items: SaleItem[],
  companySettings?: CompanySettings | null
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

  let logoData: { base64: string; format: 'PNG' | 'JPEG' } | null = null;
  if (companySettings?.logo_url) {
    // Aplicar bordas arredondadas (raio de 40px para um efeito suave)
    logoData = await loadImageAsBase64(companySettings.logo_url, 300, 0.85, 40);
  }

  // === HEADER - Logo on left, company info center, contact right ===
  if (logoData) {
    try {
      // Logo quadrado maior como na imagem de referência
      doc.addImage(logoData.base64, logoData.format, margin, yPos, 35, 35);
    } catch (e) {
      console.warn('Failed to add logo to sale:', e);
    }
  }

  // Company info - center section
  const companyInfoX = logoData ? margin + 42 : margin;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text(companySettings?.company_name || "Minha Empresa", companyInfoX, yPos + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (companySettings?.cnpj_cpf) {
    doc.text(`CNPJ: ${companySettings.cnpj_cpf}`, companyInfoX, yPos + 14);
  }
  if (companySettings?.address) {
    const addressLines = doc.splitTextToSize(companySettings.address, 80);
    doc.text(addressLines, companyInfoX, yPos + 20);
  }

  // Right side contact info
  doc.setFontSize(8);
  const rightX = pageWidth - margin;
  let rightY = yPos + 8;
  if (companySettings?.phone) {
    doc.text(companySettings.phone, rightX, rightY, { align: "right" });
    rightY += 5;
  }
  if (companySettings?.email) {
    doc.text(companySettings.email, rightX, rightY, { align: "right" });
    rightY += 5;
  }
  if (companySettings?.whatsapp) {
    doc.text(`WhatsApp: ${companySettings.whatsapp}`, rightX, rightY, { align: "right" });
  }

  yPos = 55;

  // === VENDA Nº HEADER BAR ===
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  const centerX = pageWidth / 2;
  doc.text(`VENDA Nº ${sale.sale_number}`, centerX, yPos + 5.5, { align: "center" });
  doc.text(format(new Date(sale.sold_at), "dd/MM/yyyy", { locale: ptBR }), rightX - 5, yPos + 5.5, { align: "right" });

  yPos += 12;

  // === PREVISÃO DE ENTREGA ===
  if (sale.delivery_date) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_COLOR);
    doc.text(`PREVISÃO DE ENTREGA: ${format(new Date(sale.delivery_date), "dd/MM/yyyy", { locale: ptBR })}`, margin + 3, yPos + 5);
    yPos += 10;
  }

  // === DADOS DO CLIENTE ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("DADOS DO CLIENTE", margin + 3, yPos + 5);
  yPos += 10;

  // Client table - matching the quote layout
  const customer = sale.customers;
  
  const truncate = (str: string | null | undefined, maxLen: number) => {
    if (!str) return "";
    return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
  };

  const clientData = [
    ["Cliente:", truncate(customer?.name, 50), "CNPJ/CPF:", truncate(customer?.cpf_cnpj, 25)],
    ["Endereço:", truncate(customer?.address, 70), "CEP:", truncate(customer?.cep, 18)],
    ["Cidade:", truncate(customer?.city, 35), "Estado:", truncate(customer?.state, 18)],
    ["Telefone:", truncate(customer?.phone, 25), "E-mail:", truncate(customer?.email, 35)],
  ];

  autoTable(doc, {
    startY: yPos,
    body: clientData,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineColor: [0, 0, 0], 
      lineWidth: 0.3,
      overflow: 'linebreak',
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 22, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      1: { cellWidth: 68, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      2: { fontStyle: "bold", cellWidth: 22, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      3: { cellWidth: 68, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === SERVIÇOS ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("SERVIÇOS", margin + 3, yPos + 5);
  yPos += 10;

  const tableData = items.map((item, i) => [
    (i + 1).toString(),
    item.description,
    item.quantity.toString().replace(".", ","),
    Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    Number(item.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["ITEM", "NOME", "QTD.", "VR. UNIT.", "SUB TOTAL"]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0], 
      fontStyle: "bold", 
      lineWidth: 0.3, 
      lineColor: [0, 0, 0],
      halign: "center"
    },
    bodyStyles: { 
      fontSize: 8, 
      lineWidth: 0.3, 
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 15, halign: "center", textColor: [0, 0, 0] },
      1: { cellWidth: "auto", textColor: [0, 0, 0] },
      2: { cellWidth: 20, halign: "center", textColor: [0, 0, 0] },
      3: { cellWidth: 28, halign: "center", textColor: [0, 0, 0] },
      4: { cellWidth: 28, halign: "center", textColor: [0, 0, 0] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Subtotal, Discount, Total
  const subtotal = Number(sale.subtotal);
  const discount = Number(sale.discount) || 0;
  const total = Number(sale.total);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_COLOR);
  
  if (discount > 0) {
    doc.text(`SUBTOTAL: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, yPos, { align: "right" });
    yPos += 5;
    doc.text(`DESCONTO: R$ ${discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, yPos, { align: "right" });
    yPos += 5;
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL DA VENDA: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, yPos, { align: "right" });
  yPos += 12;

  // === DADOS DO PAGAMENTO ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("DADOS DO PAGAMENTO", margin + 3, yPos + 5);
  yPos += 10;

  // Check if sale has installments
  const saleAny = sale as any;
  const installmentCount = saleAny.installment_count || 1;
  const installmentsData = saleAny.installments_data as InstallmentData[] | null;
  
  if (installmentCount > 1 && installmentsData && installmentsData.length > 0) {
    // Create installments table
    const installmentTableData = installmentsData.map((inst) => [
      `${inst.number}ª Parcela`,
      `R$ ${Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR }),
      paymentMethodLabels[inst.paymentMethod] || inst.paymentMethod,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["PARCELA", "VALOR", "VENCIMENTO", "FORMA DE PAGAMENTO"]],
      body: installmentTableData,
      margin: { left: margin, right: margin },
      headStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [0, 0, 0], 
        fontStyle: "bold", 
        lineWidth: 0.3, 
        lineColor: [0, 0, 0],
        halign: "center"
      },
      bodyStyles: { 
        fontSize: 8, 
        lineWidth: 0.3, 
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 35, halign: "center", textColor: [0, 0, 0] },
        1: { cellWidth: 35, halign: "center", textColor: [0, 0, 0] },
        2: { cellWidth: 35, halign: "center", textColor: [0, 0, 0] },
        3: { cellWidth: "auto", halign: "center", textColor: [0, 0, 0] },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    // Show single payment info in table format
    const paymentMethod = sale.payment_method 
      ? paymentMethodLabels[sale.payment_method] || sale.payment_method 
      : "-";
    const paymentStatus = sale.payment_status 
      ? paymentStatusLabels[sale.payment_status] || sale.payment_status 
      : "-";

    autoTable(doc, {
      startY: yPos,
      head: [["VALOR", "FORMA DE PAGAMENTO", "STATUS", "OBSERVAÇÃO"]],
      body: [[
        `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        paymentMethod,
        paymentStatus,
        sale.notes || "-"
      ]],
      margin: { left: margin, right: margin },
      headStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [0, 0, 0], 
        fontStyle: "bold", 
        lineWidth: 0.3, 
        lineColor: [0, 0, 0],
        halign: "center"
      },
      bodyStyles: { 
        fontSize: 8, 
        lineWidth: 0.3, 
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 35, halign: "center", textColor: [0, 0, 0] },
        1: { cellWidth: 45, halign: "center", textColor: [0, 0, 0] },
        2: { cellWidth: 35, halign: "center", textColor: [0, 0, 0] },
        3: { cellWidth: "auto", halign: "center", textColor: [0, 0, 0] },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // === OBSERVAÇÕES (if notes exist and not already shown) ===
  if (sale.notes && installmentCount > 1) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_COLOR);
    doc.text("OBSERVAÇÕES", margin + 3, yPos + 5);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const notesLines = doc.splitTextToSize(sale.notes, pageWidth - 2 * margin);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 10;
  }

  // === ASSINATURA ===
  // Garantir espaço mínimo de 40mm entre conteúdo e assinatura
  const minSignatureY = yPos + 40;
  const signatureY = Math.max(minSignatureY, pageHeight - 30);
  
  // Se assinatura ultrapassar a página, criar nova página
  if (signatureY > pageHeight - 15) {
    doc.addPage();
    const newSignatureY = 40;
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(pageWidth / 2 - 50, newSignatureY, pageWidth / 2 + 50, newSignatureY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Assinatura do cliente", pageWidth / 2, newSignatureY + 5, { align: "center" });
  } else {
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(pageWidth / 2 - 50, signatureY, pageWidth / 2 + 50, signatureY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Assinatura do cliente", pageWidth / 2, signatureY + 5, { align: "center" });
  }

  doc.save(`Venda_${sale.sale_number}.pdf`);
}
