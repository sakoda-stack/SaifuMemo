import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Edit3, HeartPulse, NotebookPen, Trash2 } from "lucide-react";
import { db, deleteExpenseCascade, getMonthlyFixedRecords } from "@/db/database";
import { EmptyState, SectionHeader, StickyActionBar } from "@/components/ui/PlannerUI";
import ExpenseBreakdownDonut from "@/components/list/ExpenseBreakdownDonut";
import { MEDICAL_TYPES, addMonths, formatDateDisplay, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, MedicalExpense, Member } from "@/types";

type Filter = "all" | "unchecked" | "medical" | "fixed";

type BreakdownTarget =
  | { kind: "all" }
  | { kind: "category"; categoryId: string; label: string }
  | { kind: "medical"; label: string };

interface DayGroup {
  date: string;
  total: number;
  expenses: Expense[];
  medicals: MedicalExpense[];
}

interface FixedRecordView {
  id: string;
  actualAmount: number;
  isConfirmed: boolean;
  templateName: string;
}

interface BreakdownSegment {
  id: string;
  kind: "category" | "medical";
  label: string;
  color: string;
  total: number;
  categoryId?: string;
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "すべて",
  unchecked: "未確認",
  medical: "医療費",
  fixed: "固定費",
};

export default function ListScreen({ initialFilter = "all" }: { initialFilter?: Filter }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownTarget>({ kind: "all" });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [fixedRecords, setFixedRecords] = useState<FixedRecordView[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingMedical, setEditingMedical] = useState<MedicalExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState({ amount: "", date: "", categoryId: "", memberId: "", shopName: "", memo: "" });
  const [medicalForm, setMedicalForm] = useState<{
    amount: string;
    date: string;
    reimbursedAmount: string;
    memberId: string;
    hospitalName: string;
    medicalType: (typeof MEDICAL_TYPES)[number];
    isTransportation: boolean;
    memo: string;
  }>({ amount: "", date: "", reimbursedAmount: "", memberId: "", hospitalName: "", medicalType: MEDICAL_TYPES[0], isTransportation: false, memo: "" });

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const load = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;
    const [categoryRows, memberRows, expenseRows, medicalRows, fixedRows, yearExpenses, yearMedicals] = await Promise.all([
      db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      db.expenses.where("date").between(start, end, true, false).toArray(),
      db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
      getMonthlyFixedRecords(year, month),
      db.expenses.where("date").between(yearStart, yearEnd, true, false).toArray(),
      db.medicalExpenses.where("paymentDate").between(yearStart, yearEnd, true, false).toArray(),
    ]);

    setCategories(categoryRows);
    setMembers(memberRows);
    setExpenses(expenseRows.sort((left, right) => right.date.localeCompare(left.date)));
    setMedicals(medicalRows.sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)));
    setFixedRecords(fixedRows);
    setYearTotal(yearExpenses.reduce((sum, expense) => sum + expense.amount, 0) + yearMedicals.reduce((sum, medical) => sum + medical.amount, 0));
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const setListFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
  };

  const handleBreakdownSelect = (segment: { kind: "category" | "medical"; categoryId?: string; label: string }) => {
    if (segment.kind === "medical") {
      setSelectedBreakdown({ kind: "medical", label: segment.label });
      return;
    }

    if (!segment.categoryId) return;
    setSelectedBreakdown({ kind: "category", categoryId: segment.categoryId, label: segment.label });
  };

  const clearBreakdownTarget = () => {
    setSelectedBreakdown({ kind: "all" });
  };

  const uncheckedCount = expenses.filter((expense) => !expense.isChecked).length + medicals.filter((medical) => !medical.isChecked).length;
  const fixedUncheckedCount = fixedRecords.filter((record) => !record.isConfirmed).length;

  const filteredExpenses = expenses.filter((expense) => {
    if (filter === "fixed" || filter === "medical") return false;
    if (filter === "unchecked" && expense.isChecked) return false;
    return true;
  });

  const filteredMedicals = medicals.filter((medical) => {
    if (filter === "fixed") return false;
    if (filter === "unchecked" && medical.isChecked) return false;
    return true;
  });

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();

    filteredExpenses.forEach((expense) => {
      const current = map.get(expense.date) ?? { date: expense.date, total: 0, expenses: [], medicals: [] };
      current.expenses.push(expense);
      current.total += expense.amount;
      map.set(expense.date, current);
    });

    filteredMedicals.forEach((medical) => {
      const current = map.get(medical.paymentDate) ?? { date: medical.paymentDate, total: 0, expenses: [], medicals: [] };
      current.medicals.push(medical);
      current.total += medical.amount;
      map.set(medical.paymentDate, current);
    });

    return Array.from(map.values()).sort((left, right) => right.date.localeCompare(left.date));
  }, [filteredExpenses, filteredMedicals]);

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const resolveMemberLabel = (memberId?: string) => memberMap.get(memberId ?? "")?.shortName || "未設定";

  const breakdownSegments = useMemo(() => {
    const medicalCategory = categories.find((category) => category.isMedical);
    const segments: BreakdownSegment[] = categories
      .filter((category) => !category.isMedical)
      .map((category) => ({
        id: category.id,
        kind: "category" as const,
        categoryId: category.id,
        label: category.name,
        color: category.colorHex || "#8f8577",
        total: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
      }))
      .filter((segment) => segment.total > 0);

    const medicalTotal = medicals.reduce((sum, medical) => sum + medical.amount, 0);
    if (medicalTotal > 0) {
      segments.push({
        id: medicalCategory?.id ?? "medical",
        kind: "medical",
        label: medicalCategory?.name ?? "医療費",
        color: medicalCategory?.colorHex || "#d46a6a",
        total: medicalTotal,
      });
    }

    const total = segments.reduce((sum, segment) => sum + segment.total, 0);

    return segments
      .sort((left, right) => right.total - left.total)
      .map((segment) => ({
        ...segment,
        share: total > 0 ? segment.total / total : 0,
        isActive:
          (segment.kind === "category" && selectedBreakdown.kind === "category" && selectedBreakdown.categoryId === segment.categoryId) ||
          (segment.kind === "medical" && selectedBreakdown.kind === "medical"),
      }));
  }, [categories, expenses, medicals, selectedBreakdown]);

  const totalSpend = breakdownSegments.reduce((sum, segment) => sum + segment.total, 0);
  const activeBreakdownLabel = selectedBreakdown.kind === "all" ? "" : selectedBreakdown.label;
  const isFixedMode = filter === "fixed";

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() || (next.year === today.getFullYear() && next.month > today.getMonth() + 1)) return;
    setYear(next.year);
    setMonth(next.month);
  };

  const toggleExpense = async (id: string) => {
    const current = await db.expenses.get(id);
    if (!current) return;
    await db.expenses.update(id, { isChecked: !current.isChecked, updatedAt: new Date() });
    await load();
  };

  const toggleMedical = async (id: string) => {
    const current = await db.medicalExpenses.get(id);
    if (!current) return;
    await db.medicalExpenses.update(id, { isChecked: !current.isChecked });
    await load();
  };

  const removeExpense = async (id: string) => {
    if (!window.confirm("この支出を削除しますか？")) return;
    await deleteExpenseCascade(id);
    await load();
  };

  const removeMedical = async (id: string) => {
    if (!window.confirm("この医療費を削除しますか？")) return;
    await db.medicalExpenses.delete(id);
    await load();
  };

  const openExpenseEditor = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      amount: String(expense.amount),
      date: expense.date,
      categoryId: expense.categoryId ?? "",
      memberId: expense.memberId ?? "",
      shopName: expense.shopName ?? "",
      memo: expense.memo ?? "",
    });
  };

  const openMedicalEditor = (medical: MedicalExpense) => {
    setEditingMedical(medical);
    setMedicalForm({
      amount: String(medical.amount),
      date: medical.paymentDate,
      reimbursedAmount: String(medical.reimbursedAmount),
      memberId: medical.memberId ?? "",
      hospitalName: medical.hospitalName ?? "",
      medicalType: medical.isTransportation ? MEDICAL_TYPES[0] : (medical.medicalType as (typeof MEDICAL_TYPES)[number]),
      isTransportation: medical.isTransportation,
      memo: medical.memo ?? "",
    });
  };

  const saveExpenseEditor = async () => {
    if (!editingExpense || !expenseForm.date || Number(expenseForm.amount) <= 0) return;
    await db.expenses.update(editingExpense.id, {
      amount: Math.round(Number(expenseForm.amount)),
      date: expenseForm.date,
      categoryId: expenseForm.categoryId || undefined,
      memberId: expenseForm.memberId || undefined,
      shopName: expenseForm.shopName.trim() || undefined,
      memo: expenseForm.memo.trim(),
      updatedAt: new Date(),
    });
    setEditingExpense(null);
    await load();
  };

  const saveMedicalEditor = async () => {
    if (!editingMedical || !medicalForm.date || !medicalForm.memberId || Number(medicalForm.amount) <= 0) return;
    await db.medicalExpenses.update(editingMedical.id, {
      amount: Math.round(Number(medicalForm.amount)),
      paymentDate: medicalForm.date,
      reimbursedAmount: Math.max(0, Math.round(Number(medicalForm.reimbursedAmount) || 0)),
      memberId: medicalForm.memberId,
      hospitalName: medicalForm.hospitalName.trim() || undefined,
      medicalType: medicalForm.isTransportation ? "通院交通費" : medicalForm.medicalType,
      isTransportation: medicalForm.isTransportation,
      memo: medicalForm.memo.trim() || undefined,
      fiscalYear: parseInt(medicalForm.date.slice(0, 4), 10),
    });
    setEditingMedical(null);
    await load();
  };

  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="planner-inline-header">
          <h2 className="planner-section-title">{formatMonthYear(year, month)}</h2>
          <div className="planner-month-switcher shrink-0">
            <button type="button" onClick={() => goMonth(-1)} className="planner-icon-button" aria-label="前の月">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => goMonth(1)} className="planner-icon-button" aria-label="次の月" disabled={year === today.getFullYear() && month === today.getMonth() + 1}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-3 planner-pill-grid planner-pill-grid-compact">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((currentFilter) => (
            <button key={currentFilter} type="button" onClick={() => setListFilter(currentFilter)} className={`planner-pill ${filter === currentFilter ? "planner-pill-active" : ""}`}>
              {FILTER_LABELS[currentFilter]}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CompactOverviewStat label="合計" value={isFixedMode ? `${fixedRecords.length}件` : `${expenses.length + medicals.length}件`} />
          <CompactOverviewStat label="未確認" value={`${isFixedMode ? fixedUncheckedCount : uncheckedCount}件`} />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader
          kicker="BREAKDOWN"
          title="支出内訳"
          action={activeBreakdownLabel ? <button type="button" onClick={clearBreakdownTarget} className="planner-link-row planner-link-row-compact">選択解除</button> : undefined}
        />
        <div className="mt-4">
          {breakdownSegments.length === 0 ? (
            <EmptyState title="支出がありません" message="この月の支出が追加されると内訳が表示されます。" />
          ) : (
            <ExpenseBreakdownDonut segments={breakdownSegments} activeLabel={activeBreakdownLabel} onSelect={handleBreakdownSelect} />
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="YEAR TOTAL" title={`${year}年 合計`} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CompactOverviewStat label="年TOTAL" value={formatYen(yearTotal)} />
          <CompactOverviewStat label="今月グラフ対象" value={formatYen(totalSpend)} />
        </div>
      </section>

      <section>
        {isFixedMode ? (
          <div className="planner-card">
            <SectionHeader kicker="FIXED" title={`固定費 ${formatYen(fixedRecords.reduce((total, record) => total + record.actualAmount, 0))}`} />
            <div className="mt-4 space-y-3">
              {fixedRecords.length === 0 ? (
                <EmptyState title="固定費はありません" message="この月の固定費はありません。" />
              ) : (
                fixedRecords.map((record) => (
                  <div key={record.id} className="planner-summary-row">
                    <div className="planner-summary-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                      <NotebookPen size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{record.templateName}</p>
                        <p className="shrink-0 text-sm font-semibold">{formatYen(record.actualAmount)}</p>
                      </div>
                      <p className="text-xs text-[var(--planner-subtle)]">{record.isConfirmed ? "確認済み" : "未確認"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="planner-card">
            <EmptyState title="記録がありません" message="表示できる記録がありません。" />
          </div>
        ) : (
          dayGroups.map((group) => (
            <div key={group.date} className="planner-card">
              <SectionHeader kicker={formatDateDisplay(group.date)} title={`合計 ${formatYen(group.total)}`} />
              <div className="mt-4 space-y-3">
                {group.expenses.map((expense) => {
                  const category = categoryMap.get(expense.categoryId ?? "");
                  const Icon = resolveIcon(category?.icon, "ReceiptText");
                  return (
                    <div key={expense.id} className={`planner-list-row ${expense.isChecked ? "planner-list-row-muted" : ""}`}>
                      <button type="button" onClick={() => toggleExpense(expense.id)} className="planner-check-button">
                        {expense.isChecked ? <CheckCircle2 size={20} className="text-[var(--planner-success)]" /> : <Circle size={20} className="text-[var(--planner-line-strong)]" />}
                      </button>
                      <div className="planner-summary-icon" style={{ backgroundColor: `${category?.colorHex || "#8f8577"}18`, color: category?.colorHex || "#8f8577" }}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{expense.shopName || expense.memo || "支出"}</p>
                          <p className="shrink-0 text-sm font-semibold">{formatYen(expense.amount)}</p>
                        </div>
                        <p className="truncate text-xs text-[var(--planner-subtle)]">{category?.name || "カテゴリ未設定"} / {resolveMemberLabel(expense.memberId)}</p>
                      </div>
                      <button type="button" onClick={() => openExpenseEditor(expense)} className="planner-icon-button" aria-label="支出を編集">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => removeExpense(expense.id)} className="planner-icon-button" aria-label="支出を削除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                {group.medicals.map((medical) => (
                  <div key={medical.id} className={`planner-list-row ${medical.isChecked ? "planner-list-row-muted" : ""}`}>
                    <button type="button" onClick={() => toggleMedical(medical.id)} className="planner-check-button">
                      {medical.isChecked ? <CheckCircle2 size={20} className="text-[var(--planner-success)]" /> : <Circle size={20} className="text-[var(--planner-line-strong)]" />}
                    </button>
                    <div className="planner-summary-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                      <HeartPulse size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{medical.hospitalName || "医療費"}</p>
                        <p className="shrink-0 text-sm font-semibold">{formatYen(medical.amount)}</p>
                      </div>
                      <p className="truncate text-xs text-[var(--planner-subtle)]">{medical.isTransportation ? "通院交通費" : medical.medicalType} / {resolveMemberLabel(medical.memberId)}</p>
                    </div>
                    <button type="button" onClick={() => openMedicalEditor(medical)} className="planner-icon-button" aria-label="医療費を編集">
                      <Edit3 size={14} />
                    </button>
                    <button type="button" onClick={() => removeMedical(medical.id)} className="planner-icon-button" aria-label="医療費を削除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {editingExpense ? (
        <div className="planner-modal">
          <div className="planner-modal-backdrop" onClick={() => setEditingExpense(null)} />
          <div className="planner-modal-sheet">
            <div className="planner-modal-scroll">
              <div className="planner-page">
                <section className="planner-card">
                  <SectionHeader kicker="EDIT" title="支出を編集" />
                  <div className="mt-4 space-y-4">
                    <Field label="金額">
                      <input type="number" inputMode="numeric" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="日付">
                      <input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="カテゴリ">
                      <div className="planner-pill-grid">
                        {categories.filter((category) => !category.isMedical).map((category) => (
                          <button key={category.id} type="button" onClick={() => setExpenseForm((current) => ({ ...current, categoryId: category.id }))} className={`planner-pill ${expenseForm.categoryId === category.id ? "planner-pill-active" : ""}`}>
                            {category.name}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="メンバー">
                      <div className="planner-pill-grid">
                        {[{ id: "", shortName: "未設定" }, ...members].map((member) => (
                          <button key={member.id || "empty"} type="button" onClick={() => setExpenseForm((current) => ({ ...current, memberId: member.id }))} className={`planner-pill ${expenseForm.memberId === member.id ? "planner-pill-active" : ""}`}>
                            {member.shortName}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="店舗名">
                      <input value={expenseForm.shopName} onChange={(event) => setExpenseForm((current) => ({ ...current, shopName: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="メモ">
                      <textarea value={expenseForm.memo} onChange={(event) => setExpenseForm((current) => ({ ...current, memo: event.target.value }))} className="planner-field min-h-[96px] resize-none" />
                    </Field>
                  </div>
                </section>
              </div>
            </div>
            <StickyActionBar primaryLabel="保存" onPrimary={saveExpenseEditor} secondaryLabel="閉じる" onSecondary={() => setEditingExpense(null)} />
          </div>
        </div>
      ) : null}

      {editingMedical ? (
        <div className="planner-modal">
          <div className="planner-modal-backdrop" onClick={() => setEditingMedical(null)} />
          <div className="planner-modal-sheet">
            <div className="planner-modal-scroll">
              <div className="planner-page">
                <section className="planner-card">
                  <SectionHeader kicker="EDIT" title="医療費を編集" />
                  <div className="mt-4 space-y-4">
                    <Field label="メンバー">
                      <div className="planner-pill-grid">
                        {members.map((member) => (
                          <button key={member.id} type="button" onClick={() => setMedicalForm((current) => ({ ...current, memberId: member.id }))} className={`planner-pill ${medicalForm.memberId === member.id ? "planner-pill-active" : ""}`}>
                            {member.shortName}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="支払日">
                      <input type="date" value={medicalForm.date} onChange={(event) => setMedicalForm((current) => ({ ...current, date: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="金額">
                      <input type="number" inputMode="numeric" value={medicalForm.amount} onChange={(event) => setMedicalForm((current) => ({ ...current, amount: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="補填額">
                      <input type="number" inputMode="numeric" value={medicalForm.reimbursedAmount} onChange={(event) => setMedicalForm((current) => ({ ...current, reimbursedAmount: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="病院 / 薬局">
                      <input value={medicalForm.hospitalName} onChange={(event) => setMedicalForm((current) => ({ ...current, hospitalName: event.target.value }))} className="planner-field" />
                    </Field>
                    <Field label="区分">
                      <div className="grid gap-2">
                        <button type="button" onClick={() => setMedicalForm((current) => ({ ...current, isTransportation: !current.isTransportation }))} className={`planner-inline-toggle ${medicalForm.isTransportation ? "planner-inline-toggle-active" : ""}`}>
                          通院交通費
                        </button>
                        {!medicalForm.isTransportation ? (
                          <div className="planner-pill-grid">
                            {MEDICAL_TYPES.map((type) => (
                              <button key={type} type="button" onClick={() => setMedicalForm((current) => ({ ...current, medicalType: type }))} className={`planner-pill ${medicalForm.medicalType === type ? "planner-pill-active" : ""}`}>
                                {type}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Field>
                    <Field label="メモ">
                      <textarea value={medicalForm.memo} onChange={(event) => setMedicalForm((current) => ({ ...current, memo: event.target.value }))} className="planner-field min-h-[96px] resize-none" />
                    </Field>
                  </div>
                </section>
              </div>
            </div>
            <StickyActionBar primaryLabel="保存" primaryTone="medical" onPrimary={saveMedicalEditor} secondaryLabel="閉じる" onSecondary={() => setEditingMedical(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactOverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="planner-compact-stat">
      <p className="planner-compact-stat-label">{label}</p>
      <p className="planner-compact-stat-value">{value}</p>
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
