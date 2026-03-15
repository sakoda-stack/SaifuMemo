import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { db } from "@/db/database";
import { downloadCSV, formatYen, generateMedicalCSV } from "@/utils";
import type { MedicalExpense, Member } from "@/types";

export default function MedicalScreen() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMember, setSelectedMember] = useState("all");
  const [records, setRecords] = useState<MedicalExpense[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalExpense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      const [memberRows, medicalRows, shopRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.medicalExpenses.where("fiscalYear").equals(selectedYear).toArray(),
        db.shopMasters.toArray(),
      ]);

      setMembers(memberRows);
      setAllRecords(medicalRows);
      setShops(new Map(shopRows.map((shop) => [shop.id, shop.name])));
      setRecords(selectedMember === "all" ? medicalRows : medicalRows.filter((record) => record.memberId === selectedMember));
    };

    load();
  }, [selectedMember, selectedYear]);

  const getMemberName = (id?: string) => members.find((member) => member.id === id)?.shortName ?? "";
  const getHospitalName = (id?: string) => shops.get(id ?? "") ?? "";

  const total = records.reduce((sum, record) => sum + record.amount, 0);
  const netTotal = records.reduce((sum, record) => sum + record.amount - record.reimbursedAmount, 0);
  const deductible = Math.max(0, netTotal - 100_000);
  const progress = Math.min(1, netTotal / 100_000);

  const exportCsv = () => {
    const csv = generateMedicalCSV(selectedYear, allRecords, getMemberName, getHospitalName);
    downloadCSV(csv, `医療費集計_${selectedYear}年.csv`);
  };

  return (
    <div className="planner-page slide-up">
      <section className="planner-card bg-[linear-gradient(135deg,rgba(212,106,106,0.96),rgba(184,89,89,0.92))] text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-white/80">医療費控除の確認</p>
            <h1 className="mt-2 font-['Hiragino_Mincho_ProN','Yu_Mincho',serif] text-3xl font-bold">{selectedYear}年分</h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/15">
            <HeartPulse size={22} />
          </div>
        </div>
        <p className="mt-5 text-4xl font-bold">{formatYen(netTotal)}</p>
        <p className="mt-1 text-xs text-white/80">補填後の医療費合計{netTotal !== total ? ` / 支払総額 ${formatYen(total)}` : ""}</p>
        <div className="mt-5 h-3 rounded-full bg-white/20">
          <div className="h-3 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-white/80">10万円ライン</span>
          <span className="font-semibold">{deductible > 0 ? `控除対象 ${formatYen(deductible)}` : `あと ${formatYen(100_000 - netTotal)}`}</span>
        </div>
      </section>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">集計する年</p>
            <h2 className="planner-subheading">年度ではなく支払年</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
      </section>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">家族ごとの確認</p>
            <h2 className="planner-subheading">対象者フィルタ</h2>
          </div>
        </div>
        <div className="planner-pill-grid mt-4">
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
      </section>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">入力済みの一覧</p>
            <h2 className="planner-subheading">明細</h2>
          </div>
          <p className="text-sm font-semibold text-[var(--planner-danger)]">{records.length}件</p>
        </div>
        <div className="mt-4 space-y-3">
          {records.length === 0 ? (
            <p className="rounded-[22px] bg-[var(--planner-soft)] px-4 py-8 text-center text-sm text-[var(--planner-subtle)]">
              この年の医療費はまだありません。
            </p>
          ) : (
            records.map((record) => (
              <div key={record.id} className="planner-row">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[rgba(212,106,106,0.16)]">
                  <HeartPulse size={18} className="text-[var(--planner-danger)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--planner-text)]">{getHospitalName(record.hospitalId) || "未設定"}</p>
                  <p className="text-xs text-[var(--planner-subtle)]">
                    {getMemberName(record.memberId) || "未設定"} ・ {record.isTransportation ? "通院交通費" : record.medicalType}
                  </p>
                </div>
                <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(record.amount)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <button type="button" onClick={exportCsv} className="planner-action w-full border-0 bg-[var(--planner-accent)] text-white">
        CSV出力を確認する
      </button>
      <p className="px-2 text-center text-xs text-[var(--planner-subtle)]">
        Excel で文字化けしにくい UTF-8 BOM 付きです。e-Tax 用にそのまま確認できます。
      </p>
    </div>
  );
}
