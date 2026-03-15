import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, HeartPulse, NotebookPen, ScanText } from "lucide-react";
import { db } from "@/db/database";
import { DataBadge, EmptyState, SectionHeader } from "@/components/ui/PlannerUI";
import { addMonths, compactYen, formatDateDisplay, formatMonthYear, formatYen, getMonthRange, toDateString } from "@/utils";
import { resolveIcon } from "@/utils/icons";

interface CalendarScreenProps {
  onAddExpense: (date?: string) => void;
  onAddMedical: (date?: string) => void;
  onAddExpenseReceipt: (date?: string) => void;
  onAddMedicalReceipt: (date?: string) => void;
}

interface CalendarEntry {
  id: string;
  type: "expense" | "medical";
  date: string;
  amount: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

interface DaySummary {
  date: string;
  total: number;
  entries: CalendarEntry[];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export default function CalendarScreen({
  onAddExpense,
  onAddMedical,
  onAddExpenseReceipt,
  onAddMedicalReceipt,
}: CalendarScreenProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [selectedDate, setSelectedDate] = useState(toDateString(today));

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [categories, expenses, medicals] = await Promise.all([
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
      ]);

      const categoryMap = new Map(categories.map((category) => [category.id, category]));
      const nextSummaries: Record<string, DaySummary> = {};

      const appendEntry = (entry: CalendarEntry) => {
        const current = nextSummaries[entry.date] ?? { date: entry.date, total: 0, entries: [] };
        current.entries.push(entry);
        current.total += entry.amount;
        nextSummaries[entry.date] = current;
      };

      expenses.forEach((expense) => {
        const category = categoryMap.get(expense.categoryId ?? "");
        appendEntry({
          id: expense.id,
          type: "expense",
          date: expense.date,
          amount: expense.amount,
          title: expense.shopName || expense.memo || "支出",
          subtitle: category?.name || "カテゴリ未設定",
          icon: category?.icon || "ReceiptText",
          color: category?.colorHex || "#7b7267",
        });
      });

      medicals.forEach((medical) => {
        appendEntry({
          id: medical.id,
          type: "medical",
          date: medical.paymentDate,
          amount: medical.amount,
          title: medical.hospitalName || "医療費",
          subtitle: medical.isTransportation ? "通院交通費" : medical.medicalType,
          icon: "HeartPulse",
          color: "#b84e41",
        });
      });

      Object.values(nextSummaries).forEach((summary) => {
        summary.entries.sort((left, right) => right.amount - left.amount);
      });

      setSummaries(nextSummaries);
      setSelectedDate((current) => {
        if (current.startsWith(`${year}-${String(month).padStart(2, "0")}`)) {
          return current;
        }

        return Object.keys(nextSummaries).sort()[0] ?? `${year}-${String(month).padStart(2, "0")}-01`;
      });
    };

    void load();
  }, [month, year]);

  const calendarCells = useMemo(() => buildCalendarCells(year, month), [month, year]);
  const selectedSummary = summaries[selectedDate];
  const monthEntries = Object.values(summaries).flatMap((summary) => summary.entries);
  const activeDays = Object.keys(summaries).length;
  const monthTotal = monthEntries.reduce((total, entry) => total + entry.amount, 0);

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() || (next.year === today.getFullYear() && next.month > today.getMonth() + 1)) {
      return;
    }

    setYear(next.year);
    setMonth(next.month);
  };

  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="planner-inline-header">
          <div className="min-w-0">
            <p className="planner-kicker">MONTH</p>
            <h2 className="planner-section-title">{formatMonthYear(year, month)}</h2>
            <p className="planner-section-description">上のカレンダーを起点に、その日の確認と追加を続けて行えます。</p>
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          <CompactOverviewStat label="合計" value={formatYen(monthTotal)} note="支出+医療費" />
          <CompactOverviewStat label="件数" value={`${monthEntries.length}件`} note="今月の記録" />
          <CompactOverviewStat label="動いた日" value={`${activeDays}日`} note="入力あり" />
        </div>
      </section>

      <section className="planner-card overflow-hidden">
        <div className="planner-calendar-header">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="planner-calendar-weekday">
              {weekday}
            </div>
          ))}
        </div>
        <div className="planner-calendar-grid">
          {calendarCells.map((cell, index) => {
            const summary = cell.date ? summaries[cell.date] : undefined;
            const isSelected = cell.date === selectedDate;
            return (
              <button
                key={`${cell.date ?? "blank"}-${index}`}
                type="button"
                disabled={!cell.date}
                onClick={() => cell.date && setSelectedDate(cell.date)}
                className={`planner-calendar-tile ${!cell.inMonth ? "planner-calendar-tile-muted" : ""} ${
                  isSelected ? "planner-calendar-tile-active" : ""
                }`}
              >
                {cell.date ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold">{parseInt(cell.date.slice(-2), 10)}</span>
                      {summary ? <span className="text-[10px] font-semibold text-[var(--planner-accent)]">{compactYen(summary.total)}</span> : null}
                    </div>
                    {summary ? (
                      <div className="mt-2 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {summary.entries.slice(0, 2).map((entry) => {
                            const Icon = resolveIcon(entry.icon, "ReceiptText");
                            return (
                              <span key={entry.id} className="planner-mini-stamp" style={{ backgroundColor: `${entry.color}18`, color: entry.color }}>
                                <Icon size={12} />
                              </span>
                            );
                          })}
                          {summary.entries.length > 2 ? <span className="planner-mini-count">+{summary.entries.length - 2}</span> : null}
                        </div>
                        <p className="truncate text-[10px] text-[var(--planner-subtle)]">{summary.entries[0]?.title}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="DAY SHEET" title={formatDateDisplay(selectedDate)} description="確認と追加をひとつの場所にまとめています。" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => onAddExpense(selectedDate)} className="planner-primary-inline planner-primary-inline-accent">
            <NotebookPen size={16} />
            支出を手入力
          </button>
          <button type="button" onClick={() => onAddExpenseReceipt(selectedDate)} className="planner-secondary-inline">
            <ScanText size={16} />
            レシートで支出追加
          </button>
          <button type="button" onClick={() => onAddMedical(selectedDate)} className="planner-primary-inline planner-primary-inline-medical">
            <HeartPulse size={16} />
            医療費を手入力
          </button>
          <button type="button" onClick={() => onAddMedicalReceipt(selectedDate)} className="planner-secondary-inline">
            <ScanText size={16} />
            レシートで医療費追加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {!selectedSummary ? (
            <EmptyState title="この日の記録はありません" message="上のボタンから、そのままこの日付で新しい記録を追加できます。" />
          ) : (
            selectedSummary.entries.map((entry) => {
              const Icon = resolveIcon(entry.icon, "ReceiptText");
              return (
                <div key={entry.id} className="planner-summary-row">
                  <div className="planner-summary-icon" style={{ backgroundColor: `${entry.color}18`, color: entry.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{entry.title}</p>
                      {entry.type === "medical" ? <DataBadge label="医療費" tone="medical" /> : null}
                    </div>
                    <p className="truncate text-xs text-[var(--planner-subtle)]">{entry.subtitle}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatYen(entry.amount)}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
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
      date: inMonth ? `${year}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}` : undefined,
    };
  });
}
