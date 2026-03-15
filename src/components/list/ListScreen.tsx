import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, HeartPulse, Trash2 } from "lucide-react";
import { db } from "@/db/database";
import { addMonths, formatDateDisplay, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, MedicalExpense, Member } from "@/types";

type Filter = "all" | "unchecked" | "medical" | "fixed";

interface DayGroup {
  date: string;
  expenses: Expense[];
  medicals: MedicalExpense[];
  total: number;
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "すべて",
  unchecked: "未確認",
  medical: "医療費",
  fixed: "固定費",
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
      db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((category) => category.isActive)),
      db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
      db.expenses.where("date").between(start, end, true, false).toArray(),
      db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
    ]);

    setCategories(categoryRows);
    setMembers(memberRows);
    setExpenses(expenseRows.sort((left, right) => right.date.localeCompare(left.date)));
    setMedicals(medicalRows.sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)));
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const uncheckedCount = expenses.filter((expense) => !expense.isChecked).length + medicals.filter((medical) => !medical.isChecked).length;

  const filteredExpenses = expenses.filter((expense) => {
    if (filter === "unchecked") return !expense.isChecked;
    if (filter === "medical") return false;
    if (filter === "fixed") return expense.isFixed;
    return true;
  });

  const filteredMedicals =
    filter === "all" || filter === "medical" || filter === "unchecked"
      ? medicals.filter((medical) => (filter === "unchecked" ? !medical.isChecked : true))
      : [];

  const groups: DayGroup[] = (() => {
    const map: Record<string, DayGroup> = {};

    filteredExpenses.forEach((expense) => {
      if (!map[expense.date]) {
        map[expense.date] = { date: expense.date, expenses: [], medicals: [], total: 0 };
      }

      map[expense.date].expenses.push(expense);
      map[expense.date].total += expense.amount;
    });

    filteredMedicals.forEach((medical) => {
      const date = medical.paymentDate;
      if (!map[date]) {
        map[date] = { date, expenses: [], medicals: [], total: 0 };
      }

      map[date].medicals.push(medical);
      map[date].total += medical.amount;
    });

    return Object.values(map).sort((left, right) => right.date.localeCompare(left.date));
  })();

  const toggleExpense = async (id: string) => {
    const expense = await db.expenses.get(id);
    if (expense) {
      await db.expenses.update(id, { isChecked: !expense.isChecked });
      load();
    }
  };

  const toggleMedical = async (id: string) => {
    const medical = await db.medicalExpenses.get(id);
    if (medical) {
      await db.medicalExpenses.update(id, { isChecked: !medical.isChecked });
      load();
    }
  };

  const deleteExpense = async (id: string) => {
    if (confirm("この支出を削除しますか？")) {
      await db.expenses.delete(id);
      load();
    }
  };

  const deleteMedical = async (id: string) => {
    if (confirm("この医療費を削除しますか？")) {
      await db.medicalExpenses.delete(id);
      load();
    }
  };

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (
      next.year > today.getFullYear() ||
      (next.year === today.getFullYear() && next.month > today.getMonth() + 1)
    ) {
      return;
    }

    setYear(next.year);
    setMonth(next.month);
  };

  return (
    <div className="planner-page slide-up">
      <div className="planner-monthbar">
        <button onClick={() => goMonth(-1)} className="planner-icon-button" aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="planner-kicker">帳面の明細</p>
          <h1 className="planner-heading">{formatMonthYear(year, month)}</h1>
        </div>
        <button
          onClick={() => goMonth(1)}
          className="planner-icon-button"
          disabled={year === today.getFullYear() && month === today.getMonth() + 1}
          aria-label="次の月"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">見たい明細を絞る</p>
            <h2 className="planner-subheading">フィルタ</h2>
          </div>
        </div>
        <div className="planner-pill-grid mt-4">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((currentFilter) => (
            <button
              key={currentFilter}
              type="button"
              onClick={() => setFilter(currentFilter)}
              className={`planner-pill ${filter === currentFilter ? "planner-pill-active" : ""}`}
            >
              {FILTER_LABELS[currentFilter]}
              {currentFilter === "unchecked" && uncheckedCount > 0 ? ` (${uncheckedCount})` : ""}
            </button>
          ))}
        </div>
      </section>

      {groups.length === 0 ? (
        <section className="planner-card">
          <p className="rounded-[22px] bg-[var(--planner-soft)] px-4 py-8 text-center text-sm text-[var(--planner-subtle)]">
            この条件に合う明細はありません。
          </p>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.date} className="planner-card">
            <div className="planner-section-header">
              <div>
                <p className="planner-kicker">{formatDateDisplay(group.date)}</p>
                <h2 className="planner-subheading">合計 {formatYen(group.total)}</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {group.expenses.map((expense) => {
                const category = categories.find((current) => current.id === expense.categoryId);
                const member = members.find((current) => current.id === expense.memberId);
                const Icon = resolveIcon(category?.icon, "ReceiptText");
                return (
                  <div key={expense.id} className={`planner-row ${expense.isChecked ? "planner-row-muted" : ""}`}>
                    <button type="button" onClick={() => toggleExpense(expense.id)} className="shrink-0">
                      {expense.isChecked ? (
                        <CheckCircle2 size={24} className="text-[var(--planner-success)]" />
                      ) : (
                        <Circle size={24} className="text-[var(--planner-line)]" />
                      )}
                    </button>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: `${category?.colorHex || "#7A7A7A"}22` }}>
                      <Icon size={18} color={category?.colorHex || "#7A7A7A"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${expense.isChecked ? "line-through" : ""}`}>
                        {expense.shopName || expense.memo || "支出"}
                      </p>
                      <p className="text-xs text-[var(--planner-subtle)]">
                        {member?.shortName || "未設定"} ・ {category?.name || "カテゴリ未設定"}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(expense.amount)}</p>
                    <button type="button" onClick={() => deleteExpense(expense.id)} className="shrink-0 text-[var(--planner-subtle)]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}

              {group.medicals.map((medical) => {
                const member = members.find((current) => current.id === medical.memberId);
                return (
                  <div key={medical.id} className={`planner-row ${medical.isChecked ? "planner-row-muted" : ""}`}>
                    <button type="button" onClick={() => toggleMedical(medical.id)} className="shrink-0">
                      {medical.isChecked ? (
                        <CheckCircle2 size={24} className="text-[var(--planner-success)]" />
                      ) : (
                        <Circle size={24} className="text-[var(--planner-line)]" />
                      )}
                    </button>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[rgba(212,106,106,0.16)]">
                      <HeartPulse size={18} className="text-[var(--planner-danger)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${medical.isChecked ? "line-through" : ""}`}>
                        {medical.hospitalName || "医療費"}
                      </p>
                      <p className="text-xs text-[var(--planner-subtle)]">
                        {member?.shortName || "未設定"} ・ {medical.isTransportation ? "通院交通費" : medical.medicalType}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(medical.amount)}</p>
                    <button type="button" onClick={() => deleteMedical(medical.id)} className="shrink-0 text-[var(--planner-subtle)]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
