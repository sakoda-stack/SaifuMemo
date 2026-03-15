import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, HeartPulse, Trash2 } from "lucide-react";
import { db, deleteExpenseCascade } from "@/db/database";
import { DataBadge, EmptyState, SectionHeader } from "@/components/ui/PlannerUI";
import { addMonths, formatDateDisplay, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, MedicalExpense, Member } from "@/types";

type Filter = "all" | "unchecked" | "medical" | "receipt";

interface DayGroup {
  date: string;
  total: number;
  expenses: Expense[];
  medicals: MedicalExpense[];
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "すべて",
  unchecked: "未確認",
  medical: "医療費",
  receipt: "画像あり",
};

export default function ListScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [filter, setFilter] = useState<Filter>("all");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    const [categoryRows, memberRows, expenseRows, medicalRows] = await Promise.all([
      db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      db.expenses.where("date").between(start, end, true, false).toArray(),
      db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
    ]);

    setCategories(categoryRows);
    setMembers(memberRows);
    setExpenses(expenseRows.sort((left, right) => right.date.localeCompare(left.date)));
    setMedicals(medicalRows.sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)));
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const uncheckedCount = expenses.filter((expense) => !expense.isChecked).length + medicals.filter((medical) => !medical.isChecked).length;
  const imageCount = expenses.filter((expense) => expense.receiptImageData).length + medicals.filter((medical) => medical.receiptImageData).length;

  const filteredExpenses = expenses.filter((expense) => {
    if (filter === "unchecked") return !expense.isChecked;
    if (filter === "medical") return false;
    if (filter === "receipt") return Boolean(expense.receiptImageData);
    return true;
  });

  const filteredMedicals = medicals.filter((medical) => {
    if (filter === "unchecked") return !medical.isChecked;
    if (filter === "medical") return true;
    if (filter === "receipt") return Boolean(medical.receiptImageData);
    return filter === "all";
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

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() || (next.year === today.getFullYear() && next.month > today.getMonth() + 1)) {
      return;
    }

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
    if (!window.confirm("この支出を削除しますか。")) {
      return;
    }

    await deleteExpenseCascade(id);
    await load();
  };

  const removeMedical = async (id: string) => {
    if (!window.confirm("この医療費を削除しますか。")) {
      return;
    }

    await db.medicalExpenses.delete(id);
    await load();
  };

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const memberMap = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="planner-inline-header">
          <div className="min-w-0">
            <p className="planner-kicker">MONTH</p>
            <h2 className="planner-section-title">{formatMonthYear(year, month)}</h2>
            <p className="planner-section-description">条件を切り替えながら今月の記録をまとめて確認します。</p>
          </div>
          <div className="planner-month-switcher shrink-0">
            <button type="button" onClick={() => goMonth(-1)} className="planner-icon-button" aria-label="前の月">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="planner-icon-button"
              aria-label="次の月"
              disabled={year === today.getFullYear() && month === today.getMonth() + 1}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-3 planner-pill-grid planner-pill-grid-compact">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((currentFilter) => (
            <button
              key={currentFilter}
              type="button"
              onClick={() => setFilter(currentFilter)}
              className={`planner-pill ${filter === currentFilter ? "planner-pill-active" : ""}`}
            >
              {FILTER_LABELS[currentFilter]}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <CompactOverviewStat label="合計" value={`${expenses.length + medicals.length}件`} note="今月" />
          <CompactOverviewStat label="未確認" value={`${uncheckedCount}件`} note="チェック待ち" />
          <CompactOverviewStat label="画像" value={`${imageCount}件`} note="OCRつき" />
        </div>
      </section>

      {dayGroups.length === 0 ? (
        <section className="planner-card">
          <EmptyState title="該当する記録がありません" message="フィルタ条件に合う記録がないか、まだ今月の入力がありません。" />
        </section>
      ) : (
        dayGroups.map((group) => (
          <section key={group.date} className="planner-card">
            <SectionHeader kicker={formatDateDisplay(group.date)} title={`合計 ${formatYen(group.total)}`} description={`${group.expenses.length + group.medicals.length} 件`} />
            <div className="mt-4 space-y-3">
              {group.expenses.map((expense) => {
                const category = categoryMap.get(expense.categoryId ?? "");
                const member = memberMap.get(expense.memberId ?? "");
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
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{expense.shopName || expense.memo || "支出"}</p>
                        {expense.receiptImageData ? <DataBadge label="画像" /> : null}
                      </div>
                      <p className="truncate text-xs text-[var(--planner-subtle)]">
                        {category?.name || "カテゴリ未設定"} / {member?.shortName || "未設定"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatYen(expense.amount)}</p>
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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{medical.hospitalName || "医療費"}</p>
                      {medical.receiptImageData ? <DataBadge label="画像" tone="medical" /> : null}
                    </div>
                    <p className="truncate text-xs text-[var(--planner-subtle)]">
                      {medical.isTransportation ? "通院交通費" : medical.medicalType} / {memberMap.get(medical.memberId ?? "")?.shortName || "未設定"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatYen(medical.amount)}</p>
                  <button type="button" onClick={() => removeMedical(medical.id)} className="planner-icon-button" aria-label="医療費を削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function CompactOverviewStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="planner-compact-stat">
      <p className="planner-compact-stat-label">{label}</p>
      <p className="planner-compact-stat-value">{value}</p>
      <p className="planner-compact-stat-note">{note}</p>
    </article>
  );
}
