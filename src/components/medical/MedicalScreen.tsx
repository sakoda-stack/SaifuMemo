import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Edit3, HeartPulse, Plus, Trash2 } from "lucide-react";
import { db } from "@/db/database";
import { DataBadge, EmptyState, SectionHeader, StickyActionBar } from "@/components/ui/PlannerUI";
import { downloadCSV, formatYen, generateMedicalCSV } from "@/utils";
import { MEDICAL_TYPES } from "@/utils";
import type { MedicalExpense, Member, ShopMaster } from "@/types";

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);

export default function MedicalScreen({ onAddMedical }: { onAddMedical: () => void }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMember, setSelectedMember] = useState("all");
  const [records, setRecords] = useState<MedicalExpense[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalExpense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<Map<string, ShopMaster>>(new Map());
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalExpense | null>(null);
  const [editMemberId, setEditMemberId] = useState("");
  const [editHospitalName, setEditHospitalName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editReimbursedAmount, setEditReimbursedAmount] = useState("");
  const [editMedicalType, setEditMedicalType] = useState<(typeof MEDICAL_TYPES)[number]>(MEDICAL_TYPES[0]);
  const [editIsTransportation, setEditIsTransportation] = useState(false);
  const [editMemo, setEditMemo] = useState("");

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

  useEffect(() => {
    void load();
  }, [selectedMember, selectedYear]);

  const getMemberName = (id?: string) => members.find((member) => member.id === id)?.shortName ?? "未設定";
  const getHospitalName = (id?: string) => shops.get(id ?? "")?.name ?? "";

  const totals = useMemo(() => {
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const reimbursed = records.reduce((sum, record) => sum + record.reimbursedAmount, 0);
    return {
      total,
      reimbursed,
      netTotal: total - reimbursed,
      count: records.length,
    };
  }, [records]);

  const monthlySeries = useMemo(() => {
    const monthMap = new Map<number, number>();
    records.forEach((record) => {
      const month = parseInt(record.paymentDate.slice(5, 7), 10);
      monthMap.set(month, (monthMap.get(month) ?? 0) + record.amount - record.reimbursedAmount);
    });
    return Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: monthMap.get(index + 1) ?? 0 }));
  }, [records]);

  const memberBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    records.forEach((record) => {
      const label = getMemberName(record.memberId);
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

  const openEditor = (record: MedicalExpense) => {
    setEditingRecord(record);
    setEditMemberId(record.memberId ?? "");
    setEditHospitalName(record.hospitalName || getHospitalName(record.hospitalId));
    setEditDate(record.paymentDate);
    setEditAmount(String(record.amount));
    setEditReimbursedAmount(String(record.reimbursedAmount));
    setEditIsTransportation(record.isTransportation);
    setEditMedicalType(record.isTransportation ? MEDICAL_TYPES[0] : (record.medicalType as (typeof MEDICAL_TYPES)[number]));
    setEditMemo(record.memo ?? "");
  };

  const closeEditor = () => {
    setEditingRecord(null);
    setEditMemberId("");
    setEditHospitalName("");
    setEditDate("");
    setEditAmount("");
    setEditReimbursedAmount("");
    setEditMedicalType(MEDICAL_TYPES[0]);
    setEditIsTransportation(false);
    setEditMemo("");
  };

  const saveEditor = async () => {
    if (!editingRecord) return;
    const amount = Math.round(Number(editAmount) || 0);
    if (!editMemberId || amount <= 0 || !editDate) return;

    await db.medicalExpenses.update(editingRecord.id, {
      memberId: editMemberId,
      hospitalName: editHospitalName.trim() || undefined,
      paymentDate: editDate,
      amount,
      reimbursedAmount: Math.max(0, Math.round(Number(editReimbursedAmount) || 0)),
      medicalType: editIsTransportation ? "通院交通費" : editMedicalType,
      isTransportation: editIsTransportation,
      memo: editMemo.trim() || undefined,
      fiscalYear: parseInt(editDate.slice(0, 4), 10),
    });

    closeEditor();
    await load();
  };

  const removeMedical = async () => {
    if (!editingRecord) return;
    if (!window.confirm("この医療費を削除しますか？")) return;
    await db.medicalExpenses.delete(editingRecord.id);
    closeEditor();
    await load();
  };

  const maxMonthTotal = Math.max(...monthlySeries.map((item) => item.total), 1);

  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="planner-inline-header">
          <button type="button" onClick={() => setYearMenuOpen((current) => !current)} className="planner-link-row">
            {selectedYear}年
            <ChevronDown size={16} />
          </button>
          <div className="planner-inline-actions">
            <button type="button" onClick={onAddMedical} className="planner-primary-inline planner-primary-inline-medical">
              <Plus size={16} />
              追加
            </button>
            <button type="button" onClick={exportCsv} className="planner-icon-button" aria-label="CSV出力">
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>

        {yearMenuOpen ? (
          <div className="mt-3 grid gap-2">
            {YEAR_OPTIONS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setSelectedYear(year);
                  setYearMenuOpen(false);
                }}
                className={`planner-pill ${selectedYear === year ? "planner-pill-active" : ""}`}
              >
                {year}年
              </button>
            ))}
          </div>
        ) : null}

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
                    {record.paymentDate} / {getMemberName(record.memberId)} / {record.isTransportation ? "通院交通費" : record.medicalType}
                  </p>
                </div>
                <button type="button" onClick={() => openEditor(record)} className="planner-icon-button" aria-label="医療費を編集">
                  <Edit3 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {editingRecord ? (
        <div className="planner-modal">
          <div className="planner-modal-backdrop" onClick={closeEditor} />
          <div className="planner-modal-sheet">
            <div className="planner-modal-scroll">
              <div className="planner-page">
                <section className="planner-card">
                  <SectionHeader kicker="EDIT" title="医療費を編集" />
                  <div className="mt-4 space-y-4">
                    <Field label="対象者">
                      <div className="planner-pill-grid">
                        {members.map((member) => (
                          <button key={member.id} type="button" onClick={() => setEditMemberId(member.id)} className={`planner-pill ${editMemberId === member.id ? "planner-pill-active" : ""}`}>
                            {member.shortName}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="支払日">
                      <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="planner-field" />
                    </Field>
                    <Field label="金額">
                      <input type="number" inputMode="numeric" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} className="planner-field" />
                    </Field>
                    <Field label="補填額">
                      <input type="number" inputMode="numeric" value={editReimbursedAmount} onChange={(event) => setEditReimbursedAmount(event.target.value)} className="planner-field" />
                    </Field>
                    <Field label="病院 / 薬局">
                      <input value={editHospitalName} onChange={(event) => setEditHospitalName(event.target.value)} className="planner-field" />
                    </Field>
                    <Field label="区分">
                      <div className="grid gap-2">
                        <button type="button" onClick={() => setEditIsTransportation((current) => !current)} className={`planner-inline-toggle ${editIsTransportation ? "planner-inline-toggle-active" : ""}`}>
                          通院交通費
                        </button>
                        {!editIsTransportation ? (
                          <div className="planner-pill-grid">
                            {MEDICAL_TYPES.map((type) => (
                              <button key={type} type="button" onClick={() => setEditMedicalType(type)} className={`planner-pill ${editMedicalType === type ? "planner-pill-active" : ""}`}>
                                {type}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Field>
                    <Field label="メモ">
                      <textarea value={editMemo} onChange={(event) => setEditMemo(event.target.value)} className="planner-field min-h-[96px] resize-none" />
                    </Field>
                    <button type="button" onClick={removeMedical} className="planner-secondary-inline">
                      <Trash2 size={14} />
                      削除
                    </button>
                  </div>
                </section>
              </div>
            </div>
            <StickyActionBar primaryLabel="保存" primaryTone="medical" onPrimary={saveEditor} secondaryLabel="閉じる" onSecondary={closeEditor} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricBlock({ label, value, side, tone = "default" }: { label: string; value: string; side: string; tone?: "default" | "medical" }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="planner-label">{label}</span>
      {children}
    </label>
  );
}
