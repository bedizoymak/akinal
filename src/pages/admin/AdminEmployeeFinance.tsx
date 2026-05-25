import { useParams } from "react-router-dom";
import FinancialStatementPage from "@/components/admin/finance/FinancialStatementPage";

export default function AdminEmployeeFinance() {
  const { id } = useParams();

  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Personel bulunamadı.</div>;

  return <FinancialStatementPage kind="employee" entityId={id} />;
}
