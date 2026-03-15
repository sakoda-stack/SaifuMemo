import { useEffect, useMemo, useState } from "react";
import { Download, HeartPulse } from "lucide-react";
import { db } from "@/db/database";
import { DataBadge, EmptyState, MetricCard, ScreenIntro, SectionHeader } from "@/components/ui/PlannerUI";
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
      deductible: Math.max(0, netTotal - 100_000),
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

  const topMonth = monthlySeries.slice().sort((left, right) => right.total - left.total)[0];
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
  }, [records, members, shops]);

  const facilityBreakdown = useMemo(() => {
    const counts = { hospital: 0, pharmacy: 0, other: 0 };
    records.forEach((record) => {
      const shopType = shops.get(record.hospitalId ?? "")?.shopType;
      if (shopType === "hospital") counts.hospital += 1;
      else if (shopType === "pharmacy") counts.pharmacy += 1;
      else counts.other += 1;
    });
    return counts;
  }, [records, shops]);

  const exportCsv = () => {
    const csv = generateMedicalCSV(selectedYear, allRecords, getMemberName, getHospitalName);
    downloadCSV(csv, `medical-${selectedYear}.csv`);
  };

  const maxMonthTotal = Math.max(...monthlySeries.map((item) => item.total), 1);

  return (
    <div className="planner-page">
      <ScreenIntro
        kicker="MEDICAL"
        title={`${selectedYear}年の医療費`}
        description="年間合計、補填後、月別推移、家族別、病院/薬局比率をスマホで追いやすく整理しました。"
        action={
          <button type="button" onClick={exportCsv} className="planner-header-action" aria-label="CSVを書き出す">
            <Download size={16} />
            <span>CSV</span>
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="年間合計" value={formatYen(totals.total)} tone="medical" note={`${totals.count} 件`} />
        <MetricCard label="補填後" value={formatYen(totals.netTotal)} note={totals.reimbursed > 0 ? `補填額 ${formatYen(totals.reimbursed)}` : "補填なし"} />
        <MetricCard
          label="控除の目安"
          value={totals.deductible > 0 ? formatYen(totals.deductible) : formatYen(Math.max(0, 100_000 - totals.netTotal))}
          note={totals.deductible > 0 ? "10万円超えの目安" : "10万円まで残り"}
        />
        <MetricCard
          label="高額月"
          value={topMonth?.total ? `${topMonth.month}月` : "-"}
          note={topMonth?.total ? `${formatYen(topMonth.total)}` : "まだデータなし"}
        />
      </div>

      <section className="planner-card">
        <SectionHeader kicker="FILTER" title="表示対象" description="年と家族を切り替えて医療費を確認します。" />
        <div className="mt-4 grid gap-3">
          <div className="planner-pill-grid">
            {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`planner-pill ${selectedYear === year ? "planner-pill-active" : ""}`}
              >
                {year}年
              </button>
            ))}
          </div>
          <div className="planner-pill-grid">
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
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr]">
        <section className="planner-card">
          <SectionHeader kicker="TREND" title="月別推移" description="グラフよりも読める一覧を優先して、棒の長さで比較します。" />
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
          <SectionHeader kicker="BREAKDOWN" title="見やすい要約" description="誰の医療費が多いか、病院と薬局の比率を整理します。" />
          <div className="mt-4 space-y-3">
            {memberBreakdown.length === 0 ? (
              <EmptyState title="医療費がまだありません" message="医療費を追加すると、家族別の要約がここに出ます。" />
            ) : (
              memberBreakdown.map((item) => (
                <div key={item.label} className="planner-summary-row">
                  <div className="planner-summary-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                    <HeartPulse size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-[var(--planner-subtle)]">{item.count} 件</p>
                  </div>
                  <p className="text-sm font-semibold">{formatYen(item.total)}</p>
                </div>
              ))
            )}

            <div className="planner-note-card">
              <p className="planner-kicker">施設比率</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <DataBadge label={`病院 ${facilityBreakdown.hospital}`} tone="medical" />
                <DataBadge label={`薬局 ${facilityBreakdown.pharmacy}`} tone="accent" />
                <DataBadge label={`その他 ${facilityBreakdown.other}`} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="planner-card">
        <SectionHeader kicker="DETAIL" title="明細一覧" description="日付、金額、対象者、病院/薬局、区分を優先して並べています。" />
        <div className="mt-4 space-y-3">
          {records.length === 0 ? (
            <EmptyState title="医療費の記録がありません" message="手入力またはレシート読み込みから追加すると、ここに明細が並びます。" />
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
                  {record.memo ? <p className="truncate text-xs text-[var(--planner-subtle)]">{record.memo}</p> : null}
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
