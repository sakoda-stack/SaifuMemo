import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, HeartPulse, NotebookPen } from "lucide-react";
import { db, getMonthlyFixedRecords } from "@/db/database";
import { DataBadge, EmptyState, SectionHeader } from "@/components/ui/PlannerUI";
import { addMonths, formatMonthYear, formatYen, getMonthRange, sumBy } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, MedicalExpense, Member } from "@/types";

interface HomeScreenProps {
  onOpenList: () => void;
  onOpenFixedList: () => void;
  onOpenCalendar: () => void;
  onOpenMedicalDashboard: () => void;
}

interface RecentRecord {
  id: string;
  date: string;
  amount: number;
  title: string;
  subtitle: string;
  color: string;
  icon: string;
}

interface FixedRecordView {
  id: string;
  actualAmount: number;
  isConfirmed: boolean;
  templateName: string;
}

const MEMBER_ALL = { id: "all", shortName: "全員" };

export default function HomeScreen({
  onOpenList,
  onOpenFixedList,
  onOpenCalendar,
  onOpenMedicalDashboard,
}: HomeScreenProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [fixedRecords, setFixedRecords] = useState<FixedRecordView[]>([]);

  const resolveMemberLabel = (memberId?: string) => {
    if (memberId === "all") return "全員";
    return members.find((member) => member.id === memberId)?.shortName ?? "未設定";
  };

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, categoryRows, expenseRows, medicalRows, monthFixedRecords] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
        getMonthlyFixedRecords(year, month),
      ]);

      setMembers(memberRows);
      setCategories(categoryRows);
      setExpenses(memberFilter === "all" ? expenseRows : expenseRows.filter((row) => row.memberId === memberFilter));
      setMedicals(memberFilter === "all" ? medicalRows : medicalRows.filter((row) => row.memberId === memberFilter));
      setFixedRecords(monthFixedRecords);
    };

    void load();
  }, [memberFilter, month, year]);

  const monthTotal = sumBy(expenses, (expense) => expense.amount);
  const medicalTotal = sumBy(medicals, (medical) => medical.amount);
  const fixedTotal = sumBy(fixedRecords, (record) => record.actualAmount);
  const recordCount = expenses.length + medicals.length;
  const activeDays = new Set([...expenses.map((expense) => expense.date), ...medicals.map((medical) => medical.paymentDate)]).size;
  const unconfirmedFixedCount = fixedRecords.filter((record) => !record.isConfirmed).length;
  const leadingCategory = categories
    .map((category) => ({
      ...category,
      total: sumBy(
        expenses.filter((expense) => expense.categoryId === category.id),
        (expense) => expense.amount,
      ),
    }))
    .filter((category) => category.total > 0)
    .sort((left, right) => right.total - left.total)[0];

  const recentRecords = useMemo<RecentRecord[]>(() => {
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    return [
      ...expenses.map((expense) => {
        const category = categoryMap.get(expense.categoryId ?? "");
        return {
          id: expense.id,
          date: expense.date,
          amount: expense.amount,
          title: expense.shopName || expense.memo || "支出",
          subtitle: `${resolveMemberLabel(expense.memberId)} / ${category?.name ?? "未設定"}`,
          color: category?.colorHex ?? "#8f8577",
          icon: category?.icon ?? "ReceiptText",
        };
      }),
      ...medicals.map((medical) => ({
        id: medical.id,
        date: medical.paymentDate,
        amount: medical.amount,
        title: medical.hospitalName || "医療費",
        subtitle: `${resolveMemberLabel(medical.memberId)} / ${medical.isTransportation ? "通院交通費" : medical.medicalType}`,
        color: "#b84e41",
        icon: "HeartPulse",
      })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5);
  }, [categories, expenses, medicals, members]);

  const memberOptions = [MEMBER_ALL, ...members];

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
        <div className="planner-home-top">
          <div className="min-w-0 flex-1">
            <p className="planner-kicker">MONTH</p>
            <h2 className="planner-home-title">{formatMonthYear(year, month)}</h2>
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
          {memberOptions.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setMemberFilter(member.id)}
              className={`planner-pill ${memberFilter === member.id ? "planner-pill-active" : ""}`}
            >
              {member.shortName}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <HomeSummaryCard label="支出" value={formatYen(monthTotal)} sideTop={`${recordCount}件`} sideBottom={leadingCategory ? leadingCategory.name : "記録なし"} onClick={onOpenList} />
          <HomeSummaryCard label="医療費" value={formatYen(medicalTotal)} sideTop={`${medicals.length}件`} sideBottom="医療費" tone="medical" onClick={onOpenMedicalDashboard} />
          <HomeSummaryCard label="記録日" value={`${activeDays}日`} sideTop="日数" sideBottom="カレンダー" onClick={onOpenCalendar} />
          <HomeSummaryCard
            label="固定費"
            value={formatYen(fixedTotal)}
            sideTop={`${fixedRecords.length}件`}
            sideBottom={unconfirmedFixedCount > 0 ? `未確認 ${unconfirmedFixedCount}` : "確認済み"}
            onClick={onOpenFixedList}
          />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="RECENT" title="最近の記録" action={<button type="button" onClick={onOpenList} className="planner-link-row planner-link-row-compact">一覧へ</button>} />
        <div className="mt-4 space-y-3">
          {recentRecords.length === 0 ? (
            <EmptyState title="記録がありません" message="支出または医療費を追加してください。" />
          ) : (
            recentRecords.map((record) => {
              const Icon = resolveIcon(record.icon, "ReceiptText");
              return (
                <button key={record.id} type="button" onClick={onOpenList} className="planner-summary-row planner-summary-row-button">
                  <div className="planner-summary-icon" style={{ backgroundColor: `${record.color}18`, color: record.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{record.title}</p>
                      <p className="shrink-0 text-sm font-semibold">{formatYen(record.amount)}</p>
                    </div>
                    <p className="truncate text-xs text-[var(--planner-subtle)]">{record.date} / {record.subtitle}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="FIXED" title="今月の固定費" action={<DataBadge label={`${fixedRecords.length}件`} />} />
        <div className="mt-4 space-y-3">
          {fixedRecords.length === 0 ? (
            <EmptyState title="固定費はありません" message="固定費テンプレートを確認してください。" />
          ) : (
            fixedRecords.map((record) => (
              <button key={record.id} type="button" onClick={onOpenFixedList} className="planner-summary-row planner-summary-row-button">
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
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function HomeSummaryCard({
  label,
  value,
  sideTop,
  sideBottom,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string;
  sideTop: string;
  sideBottom: string;
  tone?: "default" | "accent" | "medical";
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="planner-kicker">{label}</p>
        <p className="planner-home-summary-value">{value}</p>
      </div>
      <div className="planner-home-summary-side">
        <span className="planner-home-summary-meta">{sideTop}</span>
        <span className="planner-home-summary-note">{sideBottom}</span>
      </div>
    </>
  );

  if (!onClick) {
    return <article className={`planner-home-summary planner-home-summary-${tone}`}>{content}</article>;
  }

  return (
    <button type="button" onClick={onClick} className={`planner-home-summary planner-home-summary-${tone} planner-home-summary-button`}>
      {content}
    </button>
  );
}
