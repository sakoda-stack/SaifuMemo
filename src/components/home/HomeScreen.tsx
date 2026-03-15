import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, HeartPulse } from "lucide-react";
import { db } from "@/db/database";
import { addMonths, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, CategoryTotal, Expense, MedicalExpense, Member } from "@/types";

export default function HomeScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [showAllCats, setShowAllCats] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [yearMedTotal, setYearMedTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, categoryRows, expenseRows, medicalRows, yearMedicalRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((category) => category.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("fiscalYear").equals(today.getFullYear()).toArray(),
      ]);

      setMembers(memberRows);
      setCategories(categoryRows);
      setExpenses(memberFilter === "all" ? expenseRows : expenseRows.filter((expense) => expense.memberId === memberFilter));
      setMedicals(memberFilter === "all" ? medicalRows : medicalRows.filter((medical) => medical.memberId === memberFilter));
      setYearMedTotal(yearMedicalRows.reduce((sum, record) => sum + record.amount - record.reimbursedAmount, 0));
    };

    load();
  }, [memberFilter, month, year]);

  const monthTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0) + medicals.reduce((sum, medical) => sum + medical.amount, 0);
  const medicalTotal = medicals.reduce((sum, medical) => sum + medical.amount, 0);
  const activeDays = new Set([...expenses.map((expense) => expense.date), ...medicals.map((medical) => medical.paymentDate)]).size;

  const categoryTotals: CategoryTotal[] = categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      icon: category.icon,
      color: category.colorHex,
      total: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((category) => category.total > 0)
    .sort((left, right) => right.total - left.total);

  const displayCategories = showAllCats ? categoryTotals : categoryTotals.slice(0, 5);

  const recent = [
    ...expenses.map((expense) => ({ ...expense, displayDate: expense.date, kind: "expense" as const })),
    ...medicals.map((medical) => ({ ...medical, displayDate: medical.paymentDate, kind: "medical" as const })),
  ]
    .sort((left, right) => right.displayDate.localeCompare(left.displayDate))
    .slice(0, 6);

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
          <p className="planner-kicker">家計のまとめ</p>
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

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="今月の支出合計" value={formatYen(monthTotal)} accent />
        <SummaryCard label="医療費" value={formatYen(medicalTotal)} />
        <SummaryCard label="記録した日" value={`${activeDays}日`} />
      </div>

      {yearMedTotal >= 100_000 && (
        <div className="planner-card border-[rgba(212,106,106,0.3)] bg-[rgba(255,245,243,0.95)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-1 shrink-0 text-[var(--planner-danger)]" />
            <div>
              <p className="text-sm font-bold text-[var(--planner-danger)]">今年の医療費は {formatYen(yearMedTotal)}</p>
              <p className="mt-1 text-xs text-[var(--planner-subtle)]">10万円を超えています。医療費控除の確認を進めてください。</p>
            </div>
          </div>
        </div>
      )}

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">だれの家計を見るか</p>
            <h2 className="planner-subheading">家族ごとの絞り込み</h2>
          </div>
        </div>
        <div className="planner-pill-grid mt-4">
          {[{ id: "all", shortName: "全員" }, ...members].map((member) => (
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
      </section>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">よく使っている内訳</p>
            <h2 className="planner-subheading">カテゴリ別の金額</h2>
          </div>
          {categoryTotals.length > 5 && (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--planner-accent)]"
              onClick={() => setShowAllCats((current) => !current)}
            >
              {showAllCats ? "たたむ" : "全部見る"}
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {displayCategories.length === 0 ? (
            <EmptyState label="まだ支出が入っていません。" />
          ) : (
            displayCategories.map((category) => <CategoryBar key={category.categoryId} category={category} total={monthTotal} />)
          )}
        </div>
      </section>

      <section className="planner-card">
        <div className="planner-section-header">
          <div>
            <p className="planner-kicker">最近の動き</p>
            <h2 className="planner-subheading">新しい順に確認</h2>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {recent.length === 0 ? (
            <EmptyState label="まだ記録がありません。" />
          ) : (
            recent.map((item) => <RecentRow key={item.id} item={item} categories={categories} members={members} />)
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`planner-card ${accent ? "bg-[rgba(255,248,238,0.96)]" : ""}`}>
      <p className="planner-kicker">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent ? "text-[var(--planner-accent)]" : "text-[var(--planner-text)]"}`}>{value}</p>
    </div>
  );
}

function CategoryBar({ category, total }: { category: CategoryTotal; total: number }) {
  const ratio = total > 0 ? category.total / total : 0;
  const Icon = resolveIcon(category.icon, "ReceiptText");

  return (
    <div className="planner-row">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: `${category.color}22` }}>
        <Icon size={18} color={category.color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold text-[var(--planner-text)]">{category.name}</span>
          <span className="text-sm font-bold" style={{ color: category.color }}>
            {formatYen(category.total)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--planner-soft)]">
          <div className="h-2 rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: category.color }} />
        </div>
      </div>
    </div>
  );
}

function RecentRow({
  item,
  categories,
  members,
}: {
  item: (Expense & { kind: "expense"; displayDate: string }) | (MedicalExpense & { kind: "medical"; displayDate: string });
  categories: Category[];
  members: Member[];
}) {
  const isMedical = item.kind === "medical";
  const category = categories.find((current) => current.id === ("categoryId" in item ? item.categoryId : ""));
  const member = members.find((current) => current.id === item.memberId);
  const Icon = isMedical ? HeartPulse : resolveIcon(category?.icon, "ReceiptText");
  const color = isMedical ? "#D46A6A" : category?.colorHex || "#7A7A7A";

  return (
    <div className="planner-row">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: `${color}22` }}>
        <Icon size={18} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--planner-text)]">
          {isMedical ? item.hospitalName || "医療費" : item.shopName || item.memo || "支出"}
        </p>
        <p className="text-xs text-[var(--planner-subtle)]">
          {member?.shortName || "未設定"} ・ {isMedical ? "医療費" : category?.name || "カテゴリ未設定"}
        </p>
      </div>
      <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(item.amount)}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-[22px] bg-[var(--planner-soft)] px-4 py-6 text-center text-sm text-[var(--planner-subtle)]">{label}</p>;
}
