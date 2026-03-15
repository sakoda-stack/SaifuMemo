import { useEffect, useMemo, useState } from "react";
import { Download, HeartPulse } from "lucide-react";
import { db } from "@/db/database";
import { DataBadge, EmptyState, SectionHeader } from "@/components/ui/PlannerUI";
import { downloadCSV, formatYen, generateMedicalCSV } from "@/utils";
import type { MedicalExpense, Member, ShopMaster } from "@/types";

export default function MedicalScreen() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMember, setSelectedMember] = useState("all");
  const [records, setRecords] = useState<MedicalExpense[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalExpense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<Map<string, ShopMaster>>(new Map());

  useEffect(() => {
    const load = async () => {
      const [memberRows, medicalRows, shopRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.medicalExpenses.where("fiscalYear").equals(selectedYear).toArray(),
        db.shopMasters.toArray(),
      ]);

      setMembers(memberRows);
      setAllRecords(medicalRows.sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)));
      setShops(new Map(shopRows.map((shop) => [shop.id, shop])));
      setRecords(
        (selectedMember === "all" ? medicalRows : medicalRows.filter((row) => row.memberId === selectedMember)).sort((left, right) =>
          right.paymentDate.localeCompare(left.paymentDate),
        ),
      );
    };

    void load();
  }, [selectedMember, selectedYear]);

  const getMemberName = (id?: string) => members.find((member) => member.id === id)?.shortName ?? "";
  const getHospitalName = (id?: string) => shops.get(id ?? "")?.name ?? "";

  const totals = useMemo(() => {
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const reimbursed = records.reduce((sum, record) => sum + record.reimbursedAmount, 0);
    const netTotal = total - reimbursed;
    return {
      total,
      reimbursed,
      netTotal,
      count: records.length,
    };
  }, [records]);

  const monthlySeries = useMemo(() => {
    const monthMap = new Map<number, number>();
    records.forEach((record) => {
      const month = parseInt(record.paymentDate.slice(5, 7), 10);
      monthMap.set(month, (monthMap.get(month) ?? 0) + record.amount - record.reimbursedAmount);
    });

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return { month, total: monthMap.get(month) ?? 0 };
    });
  }, [records]);

  const memberBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    records.forEach((record) => {
      const label = getMemberName(record.memberId) || "未設定";
      const current = map.get(label) ?? { label, total: 0, count: 0 };
      current.total += record.amount - record.reimbursedAmount;
      current.count += 1;
      map.set(label, current);
    });
    return Array.from(map.values()).sort((left, right) => right.total - left.total);
  }, [records, members]);

  const exportCsv = () => {
    const csv = generateMedicalCSV(selectedYear, allRecords, getMemberName, getHospitalName);
    downloadCSV(csv, `medical-${selectedYear}.csv`);
  };

  const maxMonthTotal = Math.max(...monthlySeries.map((item) => item.total), 1);

  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="planner-inline-header">
          <h2 className="planner-section-title">{selectedYear}年</h2>
          <button type="button" onClick={exportCsv} className="planner-icon-button" aria-label="CSVを書き出す">
            <Download size={16} />
          </button>
        </div>
        <div className="mt-3 planner-pill-grid planner-pill-grid-compact">
          {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
            <button key={year} type="button" onClick={() => setSelectedYear(year)} className={`planner-pill ${selectedYear === year ? "planner-pill-active" : ""}`}>
              {year}年
            </button>
          ))}
        </div>
        <div className="mt-3 planner-pill-grid planner-pill-grid-compact">
          {[{ id: "all", shortName: "全員" }, ...members].map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelectedMember(member.id)}
              className={`planner-pill ${selectedMember === member.id ? "planner-pill-active" : ""}`}
            >
              {member.shortName}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <MetricBlock label="合計" value={formatYen(totals.total)} side={`${totals.count}件`} />
          <MetricBlock label="補填後" value={formatYen(totals.netTotal)} side={totals.reimbursed > 0 ? formatYen(totals.reimbursed) : "補填なし"} tone="medical" />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="MONTH" title="月別" />
        <div className="mt-4 space-y-3">
          {monthlySeries.map((item) => (
            <div key={item.month} className="planner-trend-row">
              <div className="w-10 shrink-0 text-sm font-semibold">{item.month}月</div>
              <div className="planner-bar flex-1">
                <span className="planner-bar-fill bg-[var(--planner-danger)]" style={{ width: `${item.total === 0 ? 2 : (item.total / maxMonthTotal) * 100}%` }} />
              </div>
              <div className="w-24 shrink-0 text-right text-sm font-semibold">{formatYen(item.total)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="PERSON" title="対象者別" />
        <div className="mt-4 space-y-3">
          {memberBreakdown.length === 0 ? (
            <EmptyState title="医療費がありません" message="記録を追加してください。" />
          ) : (
            memberBreakdown.map((item) => (
              <div key={item.label} className="planner-summary-row">
                <div className="planner-summary-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                  <HeartPulse size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-[var(--planner-subtle)]">{item.count}件</p>
                </div>
                <p className="text-sm font-semibold">{formatYen(item.total)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="DETAIL" title="明細" />
        <div className="mt-4 space-y-3">
          {records.length === 0 ? (
            <EmptyState title="記録がありません" message="医療費を追加してください。" />
          ) : (
            records.map((record) => (
              <div key={record.id} className="planner-list-row">
                <div className="planner-summary-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                  <HeartPulse size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{getHospitalName(record.hospitalId) || record.hospitalName || "施設未設定"}</p>
                    {record.reimbursedAmount > 0 ? <DataBadge label={`補填 ${formatYen(record.reimbursedAmount)}`} tone="accent" /> : null}
                  </div>
                  <p className="truncate text-xs text-[var(--planner-subtle)]">
                    {record.paymentDate} / {getMemberName(record.memberId) || "未設定"} / {record.isTransportation ? "通院交通費" : record.medicalType}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatYen(record.amount)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  side,
  tone = "default",
}: {
  label: string;
  value: string;
  side: string;
  tone?: "default" | "medical";
}) {
  return (
    <article className={`planner-home-summary planner-home-summary-${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="planner-kicker">{label}</p>
        <p className="planner-home-summary-value">{value}</p>
      </div>
      <div className="planner-home-summary-side">
        <span className="planner-home-summary-meta">{side}</span>
      </div>
    </article>
  );
}
