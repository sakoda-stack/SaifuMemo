import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, HeartPulse } from "lucide-react";
import { db } from "@/db/database";
import { addMonths, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, MedicalExpense } from "@/types";

interface CalendarEntry {
  id: string;
  date: string;
  amount: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  type: "expense" | "medical";
}

interface DaySummary {
  date: string;
  total: number;
  entries: CalendarEntry[];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export default function CalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [categoryRows, expenseRows, medicalRows] = await Promise.all([
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((category) => category.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
      ]);

      setCategories(categoryRows);

      const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
      const nextSummaries: Record<string, DaySummary> = {};

      const pushEntry = (entry: CalendarEntry) => {
        if (!nextSummaries[entry.date]) {
          nextSummaries[entry.date] = { date: entry.date, total: 0, entries: [] };
        }
        nextSummaries[entry.date].entries.push(entry);
        nextSummaries[entry.date].total += entry.amount;
      };

      expenseRows.forEach((expense) => {
        const category = categoryMap.get(expense.categoryId ?? "");
        pushEntry({
          id: expense.id,
          date: expense.date,
          amount: expense.amount,
          title: expense.shopName || expense.memo || category?.name || "支出",
          subtitle: category?.name || "カテゴリ未設定",
          icon: category?.icon || "ReceiptText",
          color: category?.colorHex || "#7A7A7A",
          type: "expense",
        });
      });

      medicalRows.forEach((medical) => {
        pushEntry({
          id: medical.id,
          date: medical.paymentDate,
          amount: medical.amount,
          title: medical.hospitalName || "医療費",
          subtitle: medical.isTransportation ? "通院交通費" : medical.medicalType,
          icon: "HeartPulse",
          color: "#D46A6A",
          type: "medical",
        });
      });

      Object.values(nextSummaries).forEach((summary) => {
        summary.entries.sort((left, right) => right.amount - left.amount);
      });

      setSummaries(nextSummaries);

      const firstSelectableDate =
        today.getFullYear() === year && today.getMonth() + 1 === month
          ? toDateString(today)
          : Object.keys(nextSummaries).sort()[0] || `${year}-${String(month).padStart(2, "0")}-01`;

      setSelectedDate((current) => {
        if (current && current.startsWith(`${year}-${String(month).padStart(2, "0")}`)) {
          return current;
        }
        return firstSelectableDate;
      });
    };

    load();
  }, [year, month]);

  const monthEntries = useMemo(
    () => Object.values(summaries).flatMap((summary) => summary.entries),
    [summaries],
  );
  const monthTotal = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const activeDays = Object.keys(summaries).length;
  const selectedSummary = summaries[selectedDate];

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

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
    <div className="planner-page">
      <div className="planner-monthbar">
        <button onClick={() => goMonth(-1)} className="planner-icon-button" aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="planner-kicker">見開きカレンダー</p>
          <h2 className="planner-heading">{formatMonthYear(year, month)}</h2>
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

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="今月の総額" value={formatYen(monthTotal)} note="入力済みの支出と医療費" />
        <SummaryCard label="記録件数" value={`${monthEntries.length}件`} note="家計簿と医療費の合算" />
        <SummaryCard label="動いた日" value={`${activeDays}日`} note="記録のあった日だけ色づけ" />
      </div>

      <section className="planner-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--planner-line)] bg-[var(--planner-week)]">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-2 text-center text-xs font-semibold text-[var(--planner-subtle)]">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-[var(--planner-line)]">
          {cells.map((cell, index) => {
            const summary = cell.date ? summaries[cell.date] : undefined;
            const icons = summary ? uniqueIcons(summary.entries) : [];
            const isSelected = cell.date === selectedDate;

            return (
              <button
                key={`${cell.date ?? "blank"}-${index}`}
                type="button"
                className={`planner-calendar-cell ${cell.inMonth ? "" : "planner-calendar-cell-muted"} ${
                  isSelected ? "planner-calendar-cell-active" : ""
                }`}
                onClick={() => cell.date && setSelectedDate(cell.date)}
                disabled={!cell.date}
              >
                {cell.date && (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--planner-text)]">
                        {new Date(`${cell.date}T00:00:00`).getDate()}
                      </span>
                      {summary && (
                        <span className="text-[10px] font-semibold text-[var(--planner-accent)]">
                          {compactYen(summary.total)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {icons.slice(0, 3).map((iconMeta) => {
                        const Icon = resolveIcon(iconMeta.icon, "ReceiptText");
                        return (
                          <span
                            key={`${cell.date}-${iconMeta.icon}-${iconMeta.color}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${iconMeta.color}22` }}
                          >
                            <Icon size={12} color={iconMeta.color} />
                          </span>
                        );
                      })}
                      {icons.length > 3 && (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--planner-chip)] px-1 text-[10px] font-semibold text-[var(--planner-subtle)]">
                          +{icons.length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="planner-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="planner-kicker">その日の内容</p>
            <h3 className="planner-subheading">
              {selectedSummary ? formatDateLabel(selectedSummary.date) : "日付を選んでください"}
            </h3>
          </div>
          {selectedSummary && <p className="text-lg font-bold text-[var(--planner-accent)]">{formatYen(selectedSummary.total)}</p>}
        </div>

        {!selectedSummary ? (
          <p className="rounded-[24px] bg-[var(--planner-soft)] px-4 py-6 text-center text-sm text-[var(--planner-subtle)]">
            カレンダーの日付を押すと、その日の内容が並びます。
          </p>
        ) : (
          <div className="space-y-3">
            {selectedSummary.entries.map((entry) => {
              const Icon = entry.type === "medical" ? HeartPulse : resolveIcon(entry.icon, "ReceiptText");
              return (
                <div key={entry.id} className="planner-row">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                    style={{ backgroundColor: `${entry.color}22` }}
                  >
                    <Icon size={18} color={entry.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--planner-text)]">{entry.title}</p>
                    <p className="text-xs text-[var(--planner-subtle)]">{entry.subtitle}</p>
                  </div>
                  <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(entry.amount)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="planner-card">
      <p className="planner-kicker">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--planner-text)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--planner-subtle)]">{note}</p>
    </div>
  );
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay();
  const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

    return {
      inMonth,
      date: inMonth ? `${year}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}` : "",
    };
  });
}

function uniqueIcons(entries: CalendarEntry[]) {
  const seen = new Set<string>();

  return entries.reduce<{ icon: string; color: string }[]>((list, entry) => {
    const key = `${entry.icon}-${entry.color}`;
    if (seen.has(key)) {
      return list;
    }

    seen.add(key);
    list.push({ icon: entry.icon, color: entry.color });
    return list;
  }, []);
}

function compactYen(value: number) {
  if (value >= 10000) {
    return `${Math.round(value / 1000) / 10}万`;
  }

  return value.toLocaleString("ja-JP");
}

function formatDateLabel(date: string) {
  const day = new Date(`${date}T00:00:00`);
  return `${day.getMonth() + 1}月${day.getDate()}日（${WEEKDAYS[day.getDay()]}）`;
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
