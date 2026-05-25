import { useParams } from "react-router-dom";
import FinancialStatementPage from "@/components/admin/finance/FinancialStatementPage";

export default function AdminProjectFinance() {
  const { id } = useParams();

  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Proje bulunamadı.</div>;

  return <FinancialStatementPage kind="project" entityId={id} />;
}
