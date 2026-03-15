import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, HeartPulse, MapPinned, ReceiptJapaneseYen, ShoppingBasket, Sparkles } from "lucide-react";
import { db } from "@/db/database";
import { addMonths, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, CategoryTotal, Expense, MedicalExpense, Member, ReceiptItemObservation } from "@/types";

interface BargainEntry {
  best: ReceiptItemObservation;
  competitor?: ReceiptItemObservation;
  itemLabel: string;
  savings?: number;
}

interface StoreScore {
  shopName: string;
  wins: number;
  averagePrice: number;
}

export default function HomeScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState<string>("all");

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [observations, setObservations] = useState<ReceiptItemObservation[]>([]);
  const [yearMedTotal, setYearMedTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, categoryRows, expenseRows, medicalRows, yearMedicalRows, observationRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((category) => category.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("fiscalYear").equals(today.getFullYear()).toArray(),
        db.receiptItemObservations.where("expenseDate").between(start, end, true, false).toArray(),
      ]);

      const filteredExpenses = memberFilter === "all" ? expenseRows : expenseRows.filter((expense) => expense.memberId === memberFilter);
      const filteredExpenseIds = new Set(filteredExpenses.map((expense) => expense.id));

      setMembers(memberRows);
      setCategories(categoryRows);
      setExpenses(filteredExpenses);
      setMedicals(memberFilter === "all" ? medicalRows : medicalRows.filter((medical) => medical.memberId === memberFilter));
      setObservations(observationRows.filter((observation) => filteredExpenseIds.has(observation.expenseId)));
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

  const recent = [
    ...expenses.map((expense) => ({ ...expense, displayDate: expense.date, kind: "expense" as const })),
    ...medicals.map((medical) => ({ ...medical, displayDate: medical.paymentDate, kind: "medical" as const })),
  ]
    .sort((left, right) => right.displayDate.localeCompare(left.displayDate))
    .slice(0, 5);

  const bargainEntries = useMemo(() => buildBargainEntries(observations), [observations]).slice(0, 5);
  const storeScores = useMemo(() => buildStoreScores(observations), [observations]).slice(0, 4);
  const unitComparisons = useMemo(() => buildUnitComparisons(observations), [observations]).slice(0, 4);

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
          <p className="planner-kicker">ホーム</p>
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

      <section className="planner-card planner-hero-card">
        <div className="planner-ruled-paper">
          <p className="planner-kicker">今月の家計ノート</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <HeroMetric label="支出合計" value={formatYen(monthTotal)} accent />
            <HeroMetric label="医療費" value={formatYen(medicalTotal)} />
            <HeroMetric label="動いた日" value={`${activeDays}日`} />
          </div>
          <div className="mt-5 planner-pill-grid">
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
        </div>
      </section>

      {yearMedTotal >= 100_000 && (
        <div className="planner-card border-[rgba(212,106,106,0.3)] bg-[rgba(255,245,243,0.95)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-1 shrink-0 text-[var(--planner-danger)]" />
            <div>
              <p className="text-sm font-bold text-[var(--planner-danger)]">今年の医療費は {formatYen(yearMedTotal)}</p>
              <p className="mt-1 text-xs text-[var(--planner-subtle)]">10万円を超えているので、医療費控除の確認を進めてください。</p>
            </div>
          </div>
        </div>
      )}

      <section className="planner-card">
        <SectionTitle icon={<Sparkles size={16} />} kicker="近くで何がお得か" title="買い物チャンス" />
        {bargainEntries.length === 0 ? (
          <EmptyState label="レシートOCRから商品候補が増えると、店ごとの最安値がここに出ます。" />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {bargainEntries.map((entry) => (
              <article key={`${entry.itemLabel}-${entry.best.shopName}`} className="planner-note-card">
                <p className="planner-kicker">最安候補</p>
                <h3 className="planner-wrap-text mt-2 text-lg font-bold text-[var(--planner-text)]">{entry.itemLabel}</h3>
                <p className="mt-3 text-sm text-[var(--planner-subtle)]">{entry.best.shopName || "店名未設定"}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--planner-accent)]">
                  {entry.best.unitPrice ? `${entry.best.unitPrice.toLocaleString("ja-JP")}/${entry.best.quantityUnit}` : formatYen(entry.best.totalPrice)}
                </p>
                {entry.competitor && entry.savings ? (
                  <p className="mt-2 text-xs text-[var(--planner-subtle)]">
                    {entry.competitor.shopName} より {formatYen(entry.savings)} 安い
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--planner-subtle)]">比較対象のOCRがまだ少ない商品です。</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="planner-card">
          <SectionTitle icon={<MapPinned size={16} />} kicker="スーパー比較" title="店ごとの強み" />
          {storeScores.length === 0 ? (
            <EmptyState label="OCR から商品価格を取り込むと、どの店が何品目で最安かを集計します。" />
          ) : (
            <div className="mt-4 space-y-3">
              {storeScores.map((score) => (
                <div key={score.shopName} className="planner-row">
                  <div className="planner-stamp">{score.wins}</div>
                  <div className="min-w-0 flex-1">
                    <p className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">{score.shopName}</p>
                    <p className="text-xs text-[var(--planner-subtle)]">最安を取った品目 {score.wins}件</p>
                  </div>
                  <p className="text-sm font-bold text-[var(--planner-text)]">平均 {formatYen(Math.round(score.averagePrice))}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="planner-card">
          <SectionTitle icon={<ReceiptJapaneseYen size={16} />} kicker="単価メモ" title="単価で見比べる" />
          {unitComparisons.length === 0 ? (
            <EmptyState label="枚数や ml が読めたレシートから単価比較を作ります。" />
          ) : (
            <div className="mt-4 space-y-3">
              {unitComparisons.map((item) => (
                <div key={`${item.itemLabel}-${item.best.shopName}`} className="planner-note-card">
                  <p className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">{item.itemLabel}</p>
                  <p className="mt-1 text-xs text-[var(--planner-subtle)]">{item.best.shopName}</p>
                  <p className="mt-2 text-lg font-bold text-[var(--planner-accent)]">
                    {item.best.unitPrice?.toLocaleString("ja-JP")}/{item.best.quantityUnit}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="planner-card">
        <SectionTitle icon={<ShoppingBasket size={16} />} kicker="カテゴリ別のまとまり" title="内訳カード" />
        <div className="mt-4 space-y-3">
          {categoryTotals.length === 0 ? (
            <EmptyState label="まだ支出が入っていません。" />
          ) : (
            categoryTotals.slice(0, 5).map((category) => <CategoryCard key={category.categoryId} category={category} total={monthTotal} />)
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionTitle icon={<HeartPulse size={16} />} kicker="最近の記録" title="入力した内容" />
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

function HeroMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="planner-note-card">
      <p className="planner-kicker">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? "text-[var(--planner-accent)]" : "text-[var(--planner-text)]"}`}>{value}</p>
    </div>
  );
}

function SectionTitle({ icon, kicker, title }: { icon: JSX.Element; kicker: string; title: string }) {
  return (
    <div className="planner-section-header">
      <div className="flex items-start gap-3">
        <div className="planner-stamp planner-stamp-soft">{icon}</div>
        <div>
          <p className="planner-kicker">{kicker}</p>
          <h2 className="planner-subheading">{title}</h2>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, total }: { category: CategoryTotal; total: number }) {
  const ratio = total > 0 ? category.total / total : 0;
  const Icon = resolveIcon(category.icon, "ReceiptText");

  return (
    <div className="planner-row">
      <div className="planner-stamp" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
        <Icon size={18} color={category.color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">{category.name}</span>
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
      <div className="planner-stamp" style={{ backgroundColor: `${color}22`, color }}>
        <Icon size={18} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">
          {isMedical ? item.hospitalName || "医療費" : item.shopName || item.memo || "支出"}
        </p>
        <p className="planner-wrap-text text-xs text-[var(--planner-subtle)]">
          {member?.shortName || "未設定"} ・ {isMedical ? "医療費" : category?.name || "カテゴリ未設定"}
        </p>
      </div>
      <p className="text-sm font-bold text-[var(--planner-text)]">{formatYen(item.amount)}</p>
    </div>
  );
}

function buildBargainEntries(observations: ReceiptItemObservation[]): BargainEntry[] {
  const byItem = new Map<string, ReceiptItemObservation[]>();
  observations.forEach((observation) => {
    if (!observation.normalizedItemName || !(observation.shopName || observation.shopId)) {
      return;
    }
    const key = observation.normalizedItemName;
    byItem.set(key, [...(byItem.get(key) ?? []), observation]);
  });

  return Array.from(byItem.values())
    .map((rows) => {
      const ranked = rows
        .slice()
        .sort((left, right) => getComparablePrice(left) - getComparablePrice(right));
      const best = ranked[0];
      const competitor = ranked.find((row) => (row.shopName || row.shopId) !== (best.shopName || best.shopId));
      return {
        itemLabel: best.itemName,
        best,
        competitor,
        savings: competitor ? Math.max(0, competitor.totalPrice - best.totalPrice) : undefined,
      };
    })
    .sort((left, right) => (right.savings ?? 0) - (left.savings ?? 0));
}

function buildStoreScores(observations: ReceiptItemObservation[]): StoreScore[] {
  const bargains = buildBargainEntries(observations);
  const map = new Map<string, { wins: number; totalPrice: number }>();

  bargains.forEach((entry) => {
    const shopName = entry.best.shopName || "店名未設定";
    const current = map.get(shopName) ?? { wins: 0, totalPrice: 0 };
    current.wins += 1;
    current.totalPrice += entry.best.totalPrice;
    map.set(shopName, current);
  });

  return Array.from(map.entries())
    .map(([shopName, stats]) => ({
      shopName,
      wins: stats.wins,
      averagePrice: stats.totalPrice / stats.wins,
    }))
    .sort((left, right) => right.wins - left.wins || left.averagePrice - right.averagePrice);
}

function buildUnitComparisons(observations: ReceiptItemObservation[]): BargainEntry[] {
  return buildBargainEntries(observations).filter((entry) => Boolean(entry.best.unitPrice && entry.best.quantityUnit));
}

function getComparablePrice(observation: ReceiptItemObservation) {
  return observation.unitPrice ?? observation.totalPrice;
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-[22px] bg-[var(--planner-soft)] px-4 py-6 text-center text-sm text-[var(--planner-subtle)]">{label}</p>;
}
