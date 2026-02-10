import { ReportsDashboard } from "@/components/reports/ReportsDashboard";

export default function Reports() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Analise o desempenho do seu negócio</p>
      </div>
      <ReportsDashboard />
    </div>
  );
}
