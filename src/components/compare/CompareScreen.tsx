import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { db } from "@/db/database";
import { DataBadge, EmptyState, MetricCard, ScreenIntro, SectionHeader } from "@/components/ui/PlannerUI";
import { buildProductComparisons, buildStoreSummaries } from "@/utils/compare";
import { addMonths, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import type { Expense, Member, ReceiptItemObservation } from "@/types";

export default function CompareScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [observations, setObservations] = useState<ReceiptItemObservation[]>([]);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, expenseRows, observationRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.receiptItemObservations.where("expenseDate").between(start, end, true, false).toArray(),
      ]);

      const filteredExpenses = memberFilter === "all" ? expenseRows : expenseRows.filter((row) => row.memberId === memberFilter);
      const expenseIds = new Set(filteredExpenses.map((row) => row.id));

      setMembers(memberRows);
      setExpenses(filteredExpenses);
      setObservations(observationRows.filter((row) => expenseIds.has(row.expenseId)));
    };

    void load();
  }, [memberFilter, month, year]);

  const comparisons = useMemo(() => buildProductComparisons(observations), [observations]);
  const storeSummaries = useMemo(() => buildStoreSummaries(comparisons), [comparisons]);
  const strongComparisons = comparisons.filter((item) => item.confidence === "strong");

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
      <ScreenIntro
        kicker="COMPARE"
        title={formatMonthYear(year, month)}
        description="各スーパーで何が安いかを、商品別の単価表から先に見せます。"
        action={
          <div className="planner-month-switcher">
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
        }
      />

      <section className="planner-card">
        <SectionHeader kicker="FILTER" title="対象" description="家族ごとに比較したい場合はここで切り替えます。" />
        <div className="mt-4 planner-pill-grid">
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
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="OCR 商品行" value={`${observations.length} 件`} note="比較元になった明細数" />
          <MetricCard label="比較できた商品" value={`${comparisons.length} 件`} tone="accent" note="店ごとの差が見える商品" />
          <MetricCard label="単価比較" value={`${strongComparisons.length} 件`} note="同じ単位で比較できた件数" />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="1" title="各スーパーの得意商品" description="まずは各店の勝ち筋から見ます。" />
        <div className="mt-4 space-y-3">
          {storeSummaries.length === 0 ? (
            <EmptyState title="まだ比較できません" message="レシート入力で商品行を取り込むと、各スーパーの得意商品がここに出ます。" />
          ) : (
            storeSummaries.map((summary) => (
              <article key={summary.shopName} className="planner-note-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="planner-kicker">STORE</p>
                    <h3 className="mt-2 text-lg font-semibold">{summary.shopName}</h3>
                    <p className="mt-2 text-sm text-[var(--planner-subtle)]">
                      強い商品 {summary.strongWinCount} 件 / 勝ち筋 {summary.winCount} 件 / 平均 {formatYen(summary.averageWinningPrice)}
                    </p>
                  </div>
                  <DataBadge label={`${summary.winCount} wins`} tone="accent" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.winningItems.slice(0, 5).map((item) => (
                    <span key={`${summary.shopName}-${item.normalizedItemName}`} className="planner-inline-pill">
                      {item.itemLabel}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="2" title="商品別の最安店" description="単価が取れる商品は単価優先、弱いデータは参考扱いにします。" />
        <div className="mt-4 space-y-3">
          {comparisons.length === 0 ? (
            <EmptyState title="商品比較はまだありません" message="同じ商品を別の店で購入すると、ここで最安店が見えるようになります。" />
          ) : (
            comparisons.map((comparison) => (
              <article key={comparison.normalizedItemName} className="planner-comparison-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{comparison.itemLabel}</p>
                    <DataBadge label={comparison.confidence === "strong" ? "比較可" : "参考"} tone={comparison.confidence === "strong" ? "accent" : "warning"} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--planner-subtle)]">
                    最安 {comparison.best.shopName}
                    {comparison.runnerUp ? ` / 次点 ${comparison.runnerUp.shopName}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-[var(--planner-subtle)]">
                    最終購入日 {comparison.best.latestDate} / サンプル {comparison.best.sampleCount} 件
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-[var(--planner-accent)]">
                    {comparison.comparisonBasis === "unit" && comparison.best.quantityUnit
                      ? `${comparison.best.comparisonPrice.toLocaleString("ja-JP")} / ${comparison.best.quantityUnit}`
                      : formatYen(comparison.best.comparisonPrice)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--planner-subtle)]">
                    {comparison.priceGap ? `${formatYen(comparison.priceGap)} 差` : "差額は小さい"}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="3" title="比較元データ" description="どのレシート行を使っているかを最後に一覧します。" />
        <div className="mt-4 space-y-3">
          {observations.length === 0 ? (
            <EmptyState title="明細がありません" message="レシートOCRで商品行を保存すると、比較元データとしてここに並びます。" />
          ) : (
            observations
              .slice()
              .sort((left, right) => right.expenseDate.localeCompare(left.expenseDate))
              .slice(0, 30)
              .map((item) => (
                <div key={item.id} className="planner-summary-row">
                  <div className="planner-summary-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                    <Store size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.itemName}</p>
                    <p className="truncate text-xs text-[var(--planner-subtle)]">
                      {item.shopName || "店舗未設定"} / {item.expenseDate}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {item.unitPrice && item.quantityUnit
                      ? `${item.unitPrice.toLocaleString("ja-JP")} / ${item.quantityUnit}`
                      : formatYen(item.totalPrice)}
                  </p>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
