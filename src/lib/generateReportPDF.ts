import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type CompanySettings = Tables<"company_settings">;

interface FinancialSummary {
  totalPaidIncome: number;
  totalPendingIncome: number;
  paidExpenses: number;
  pendingExpenses: number;
  profit: number;
  profitMargin: number;
  breakEvenProgress: number;
  surplusDeficit: number;
  salesCount: number;
}

interface MonthlyData {
  month: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

interface TopCustomer {
  name: string;
  total: number;
  count: number;
}

interface TopSubscriptionCustomer {
  name: string;
  monthlyValue: number;
}

interface CategoryData {
  name: string;
  value: number;
  color?: string | null;
}

interface CustomerProfile {
  customer: Tables<"customers">;
  totalRevenue: number;
  totalSalesAmount: number;
  salesCount: number;
  avgSaleValue: number;
  totalMonthlySubscription: number;
  totalSubPaymentsReceived: number;
  subPaymentsCount: number;
  subscriptionsCount: number;
  topItems: { description: string; quantity: number; total: number }[];
  monthlyHistory: { month: string; value: number }[];
  preferredPaymentMethod: string;
  firstPurchase?: string;
  lastPurchase?: string;
  totalTransactions: number;
}

export interface FinancialReportData {
  type: 'financial';
  startDate: string;
  endDate: string;
  summary: FinancialSummary;
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  topCustomersBySales: TopCustomer[];
  topCustomersBySubscription: TopSubscriptionCustomer[];
  companySettings?: CompanySettings | null;
}

export interface CustomerReportData {
  type: 'customer';
  startDate: string;
  endDate: string;
  customerProfile: CustomerProfile;
  companySettings?: CompanySettings | null;
}

export type ReportData = FinancialReportData | CustomerReportData;

const TEXT_COLOR: [number, number, number] = [0, 0, 0];

async function loadImageAsBase64(url: string, maxWidth = 300, quality = 0.85, borderRadius = 0): Promise<{ base64: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    if (url.toLowerCase().endsWith('.ico')) return null;
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
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

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export async function generateReportPDF(data: ReportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

  let logoData: { base64: string; format: 'PNG' | 'JPEG' } | null = null;
  if (data.companySettings?.logo_url) {
    logoData = await loadImageAsBase64(data.companySettings.logo_url, 300, 0.85, 40);
  }

  // === HEADER - Same as Quote PDF ===
  if (logoData) {
    try {
      doc.addImage(logoData.base64, logoData.format, margin, yPos, 35, 35);
    } catch (e) {
      console.warn('Failed to add logo:', e);
    }
  }

  // Company info - center section
  const companyInfoX = logoData ? margin + 42 : margin;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text(data.companySettings?.company_name || "Minha Empresa", companyInfoX, yPos + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (data.companySettings?.cnpj_cpf) {
    doc.text(`CNPJ: ${data.companySettings.cnpj_cpf}`, companyInfoX, yPos + 14);
  }
  if (data.companySettings?.address) {
    const addressLines = doc.splitTextToSize(data.companySettings.address, 80);
    doc.text(addressLines, companyInfoX, yPos + 20);
  }

  // Right side contact info
  doc.setFontSize(8);
  const rightX = pageWidth - margin;
  let rightY = yPos + 8;
  if (data.companySettings?.phone) {
    doc.text(data.companySettings.phone, rightX, rightY, { align: "right" });
    rightY += 5;
  }
  if (data.companySettings?.email) {
    doc.text(data.companySettings.email, rightX, rightY, { align: "right" });
    rightY += 5;
  }
  if (data.companySettings?.whatsapp) {
    doc.text(`WhatsApp: ${data.companySettings.whatsapp}`, rightX, rightY, { align: "right" });
  }

  yPos = 55;

  // === REPORT TITLE BAR ===
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const centerX = pageWidth / 2;
  const reportTitle = data.type === 'customer' ? 'RELATÓRIO DO CLIENTE' : 'RELATÓRIO FINANCEIRO';
  doc.text(reportTitle, centerX, yPos + 5.5, { align: "center" });
  
  const periodText = `${format(new Date(data.startDate), "dd/MM/yyyy")} a ${format(new Date(data.endDate), "dd/MM/yyyy")}`;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(periodText, rightX - 5, yPos + 5.5, { align: "right" });

  yPos += 12;

  if (data.type === 'financial') {
    yPos = renderFinancialReport(doc, data, yPos, pageWidth, margin);
  } else {
    yPos = renderCustomerReport(doc, data, yPos, pageWidth, margin);
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(data.companySettings?.company_name || "", margin, pageHeight - 8);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, rightX, pageHeight - 8, { align: "right" });
  }

  const filename = data.type === 'customer' 
    ? `Relatorio_${data.customerProfile.customer.name.replace(/\s+/g, '_')}_${format(new Date(), "yyyy-MM-dd")}.pdf`
    : `Relatorio_Financeiro_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  
  doc.save(filename);
}

function renderFinancialReport(
  doc: jsPDF, data: FinancialReportData, yPos: number,
  pageWidth: number, margin: number
): number {
  const { summary, monthlyData, categoryData, topCustomersBySales, topCustomersBySubscription } = data;

  // === RESUMO FINANCEIRO ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("RESUMO FINANCEIRO", margin + 3, yPos + 5);
  yPos += 10;

  const summaryData = [
    ["Receita Total (Paga)", formatCurrency(summary.totalPaidIncome), "Receita Pendente", formatCurrency(summary.totalPendingIncome)],
    ["Despesas Pagas", formatCurrency(summary.paidExpenses), "Despesas Pendentes", formatCurrency(summary.pendingExpenses)],
    ["Lucro Líquido", formatCurrency(summary.profit), "Margem de Lucro", `${summary.profitMargin.toFixed(1)}%`],
    ["Total de Vendas", `${summary.salesCount} vendas`, "Ponto de Equilíbrio", `${Math.min(summary.breakEvenProgress, 999).toFixed(0)}%`],
  ];

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineColor: [0, 0, 0], 
      lineWidth: 0.3,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      1: { cellWidth: 45, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      2: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      3: { cellWidth: 45, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === PONTO DE EQUILÍBRIO ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ANÁLISE DO PONTO DE EQUILÍBRIO", margin + 3, yPos + 5);
  yPos += 10;

  const beStatus = summary.breakEvenProgress >= 100 
    ? `Meta Atingida! Superávit de ${formatCurrency(summary.surplusDeficit)}`
    : `Em progresso. Faltam ${formatCurrency(Math.abs(summary.surplusDeficit))} para atingir a meta.`;

  const beData = [
    ["Progresso", `${Math.min(summary.breakEvenProgress, 999).toFixed(0)}%`, "Status", beStatus],
    ["Receitas Totais", formatCurrency(summary.totalPaidIncome), "Despesas Totais", formatCurrency(summary.paidExpenses)],
  ];

  autoTable(doc, {
    startY: yPos,
    body: beData,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineColor: [0, 0, 0], 
      lineWidth: 0.3,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35, fillColor: [255, 255, 255] },
      1: { cellWidth: 55, fillColor: [255, 255, 255] },
      2: { fontStyle: "bold", cellWidth: 35, fillColor: [255, 255, 255] },
      3: { cellWidth: 55, fillColor: [255, 255, 255] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === EVOLUÇÃO MENSAL ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("EVOLUÇÃO MENSAL", margin + 3, yPos + 5);
  yPos += 10;

  const monthlyTableData = monthlyData.map(m => [
    m.month.toUpperCase(),
    formatCurrency(m.receitas),
    formatCurrency(m.despesas),
    formatCurrency(m.lucro),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["MÊS", "RECEITAS", "DESPESAS", "LUCRO"]],
    body: monthlyTableData,
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
      textColor: [0, 0, 0],
      halign: "center"
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 45 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === TOP CLIENTES POR VENDAS ===
  if (topCustomersBySales.length > 0) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOP CLIENTES (VENDAS)", margin + 3, yPos + 5);
    yPos += 10;

    const customerTableData = topCustomersBySales.map((c, i) => [
      `${i + 1}º`,
      c.name,
      `${c.count} vendas`,
      formatCurrency(c.total),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["#", "CLIENTE", "QUANTIDADE", "TOTAL"]],
      body: customerTableData,
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
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 35, halign: "center" },
        3: { cellWidth: 40, halign: "center" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // === TOP CLIENTES POR ASSINATURA ===
  if (topCustomersBySubscription.length > 0) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOP CLIENTES (ASSINATURAS)", margin + 3, yPos + 5);
    yPos += 10;

    const subTableData = topCustomersBySubscription.map((c, i) => [
      `${i + 1}º`,
      c.name,
      `${formatCurrency(c.monthlyValue)}/mês`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["#", "CLIENTE", "VALOR MENSAL"]],
      body: subTableData,
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
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 50, halign: "center" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // === DESPESAS POR CATEGORIA ===
  if (categoryData.length > 0) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DESPESAS POR CATEGORIA", margin + 3, yPos + 5);
    yPos += 10;

    const totalExpenses = categoryData.reduce((sum, c) => sum + c.value, 0);
    const categoryTableData = categoryData.map(c => [
      c.name,
      formatCurrency(c.value),
      totalExpenses > 0 ? `${((c.value / totalExpenses) * 100).toFixed(1)}%` : "0%",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["CATEGORIA", "VALOR", "PERCENTUAL"]],
      body: categoryTableData,
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
        0: { cellWidth: "auto" },
        1: { cellWidth: 50, halign: "center" },
        2: { cellWidth: 35, halign: "center" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  return yPos;
}

function renderCustomerReport(
  doc: jsPDF, data: CustomerReportData, yPos: number,
  pageWidth: number, margin: number
): number {
  const { customerProfile } = data;
  const { customer } = customerProfile;

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

  const truncate = (str: string | null | undefined, maxLen: number) => {
    if (!str) return "-";
    return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
  };

  const clientData = [
    ["Cliente:", truncate(customer.name, 50), "CNPJ/CPF:", truncate(customer.cpf_cnpj, 25)],
    ["Empresa:", truncate(customer.company, 50), "Telefone:", truncate(customer.phone, 25)],
    ["Endereço:", truncate(customer.address, 50), "E-mail:", truncate(customer.email, 35)],
    ["Cidade:", truncate(customer.city, 35), "Estado:", truncate(customer.state, 18)],
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
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 22, fillColor: [255, 255, 255] },
      1: { cellWidth: 68, fillColor: [255, 255, 255] },
      2: { fontStyle: "bold", cellWidth: 22, fillColor: [255, 255, 255] },
      3: { cellWidth: 68, fillColor: [255, 255, 255] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === RESUMO DO CLIENTE ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO FINANCEIRO DO CLIENTE", margin + 3, yPos + 5);
  yPos += 10;

  const paymentMethodLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    card: "Cartão",
    transfer: "Transferência",
    open: "Em Aberto",
  };

  const summaryData = [
    ["Receita Total", formatCurrency(customerProfile.totalRevenue), "Total Transações", `${customerProfile.totalTransactions}`],
    ["Total em Vendas", formatCurrency(customerProfile.totalSalesAmount), "Quantidade de Vendas", `${customerProfile.salesCount}`],
    ["Assinaturas Recebidas", formatCurrency(customerProfile.totalSubPaymentsReceived), "Valor Mensal Ativo", `${formatCurrency(customerProfile.totalMonthlySubscription)}/mês`],
    ["Ticket Médio", formatCurrency(customerProfile.avgSaleValue), "Forma de Pagamento Preferida", paymentMethodLabels[customerProfile.preferredPaymentMethod] || customerProfile.preferredPaymentMethod],
  ];

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineColor: [0, 0, 0], 
      lineWidth: 0.3,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255] },
      1: { cellWidth: 45, fillColor: [255, 255, 255] },
      2: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255] },
      3: { cellWidth: 45, fillColor: [255, 255, 255] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === HISTÓRICO DE COMPRAS ===
  if (customerProfile.monthlyHistory.some(m => m.value > 0)) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("HISTÓRICO DE COMPRAS MENSAL", margin + 3, yPos + 5);
    yPos += 10;

    const historyTableData = customerProfile.monthlyHistory
      .filter(m => m.value > 0)
      .map(m => [m.month.toUpperCase(), formatCurrency(m.value)]);

    if (historyTableData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [["MÊS", "VALOR"]],
        body: historyTableData,
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
          textColor: [0, 0, 0],
          halign: "center"
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // === TOP SERVIÇOS/PRODUTOS ===
  if (customerProfile.topItems.length > 0) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOP SERVIÇOS/PRODUTOS", margin + 3, yPos + 5);
    yPos += 10;

    const itemsTableData = customerProfile.topItems.map((item, i) => [
      `${i + 1}º`,
      item.description,
      `${item.quantity}`,
      formatCurrency(item.total),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["#", "DESCRIÇÃO", "QTD", "TOTAL"]],
      body: itemsTableData,
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
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 40, halign: "center" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // === TIMELINE ===
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMAÇÕES ADICIONAIS", margin + 3, yPos + 5);
  yPos += 10;

  const timelineData = [
    [
      "Primeira Compra:", 
      customerProfile.firstPurchase ? format(new Date(customerProfile.firstPurchase), "dd/MM/yyyy", { locale: ptBR }) : "N/A",
      "Última Compra:", 
      customerProfile.lastPurchase ? format(new Date(customerProfile.lastPurchase), "dd/MM/yyyy", { locale: ptBR }) : "N/A"
    ],
    [
      "Assinaturas Ativas:", 
      `${customerProfile.subscriptionsCount}`,
      "Pagamentos de Assinatura:", 
      `${customerProfile.subPaymentsCount}`
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    body: timelineData,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineColor: [0, 0, 0], 
      lineWidth: 0.3,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255] },
      1: { cellWidth: 45, fillColor: [255, 255, 255] },
      2: { fontStyle: "bold", cellWidth: 45, fillColor: [255, 255, 255] },
      3: { cellWidth: 45, fillColor: [255, 255, 255] },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  return yPos;
}
