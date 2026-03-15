import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPinned, ReceiptJapaneseYen, Sparkles, Store } from "lucide-react";
import { db } from "@/db/database";
import { addMonths, formatMonthYear, formatYen, getMonthRange } from "@/utils";
import type { Expense, Member, ReceiptItemObservation } from "@/types";

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

export default function CompareScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [observations, setObservations] = useState<ReceiptItemObservation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, expenseRows, observationRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.receiptItemObservations.where("expenseDate").between(start, end, true, false).toArray(),
      ]);

      const filteredExpenses = memberFilter === "all" ? expenseRows : expenseRows.filter((expense) => expense.memberId === memberFilter);
      const expenseIds = new Set(filteredExpenses.map((expense) => expense.id));

      setMembers(memberRows);
      setExpenses(filteredExpenses);
      setObservations(observationRows.filter((observation) => expenseIds.has(observation.expenseId)));
    };

    load();
  }, [memberFilter, month, year]);

  const bargains = useMemo(() => buildBargainEntries(observations), [observations]);
  const storeScores = useMemo(() => buildStoreScores(observations), [observations]);
  const unitComparisons = useMemo(() => buildUnitComparisons(observations), [observations]);

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() || (next.year === today.getFullYear() && next.month > today.getMonth() + 1)) {
      return;
    }

    setYear(next.year);
    setMonth(next.month);
  };

  return (
    <div className="planner-page slide-up">
      <div className="planner-monthbar">
        <button type="button" onClick={() => goMonth(-1)} className="planner-icon-button" aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="planner-kicker">スーパー比較</p>
          <h1 className="planner-heading">{formatMonthYear(year, month)}</h1>
        </div>
        <button
          type="button"
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
          <p className="planner-kicker">比較の元データ</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="OCR商品数" value={`${observations.length}件`} />
            <MetricCard label="最安候補" value={`${bargains.length}件`} accent />
            <MetricCard label="対象レシート" value={`${expenses.length}件`} />
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

      <section className="planner-card">
        <SectionTitle icon={<Sparkles size={16} />} kicker="最安候補" title="今月のお得メモ" />
        {bargains.length === 0 ? (
          <EmptyState label="OCRで読み取った商品情報が増えると、ここに店ごとの最安候補が出ます。" />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {bargains.slice(0, 6).map((entry) => (
              <article key={`${entry.itemLabel}-${entry.best.shopName}`} className="planner-note-card">
                <p className="planner-kicker">この店が安い</p>
                <h3 className="planner-wrap-text mt-2 text-lg font-bold text-[var(--planner-text)]">{entry.itemLabel}</h3>
                <p className="mt-3 text-sm text-[var(--planner-subtle)]">{entry.best.shopName || "店名未設定"}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--planner-accent)]">
                  {entry.best.unitPrice ? `${entry.best.unitPrice.toLocaleString("ja-JP")}/${entry.best.quantityUnit}` : formatYen(entry.best.totalPrice)}
                </p>
                <p className="mt-2 text-xs text-[var(--planner-subtle)]">
                  {entry.competitor ? `${entry.competitor.shopName}より ${formatYen(entry.savings ?? 0)} 安い` : "比較対象がまだ少ない商品です。"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="planner-card">
          <SectionTitle icon={<MapPinned size={16} />} kicker="店ごとの勝ち数" title="どの店が強いか" />
          {storeScores.length === 0 ? (
            <EmptyState label="商品価格の比較材料が増えると、店ごとの強みを集計します。" />
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
          <SectionTitle icon={<ReceiptJapaneseYen size={16} />} kicker="単価比較" title="バラ買いで見比べる" />
          {unitComparisons.length === 0 ? (
            <EmptyState label="枚数やml付きの商品が増えると、単価の安い順で並びます。" />
          ) : (
            <div className="mt-4 space-y-3">
              {unitComparisons.slice(0, 6).map((entry) => (
                <div key={`${entry.itemLabel}-${entry.best.shopName}`} className="planner-note-card">
                  <p className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">{entry.itemLabel}</p>
                  <p className="mt-1 text-xs text-[var(--planner-subtle)]">{entry.best.shopName}</p>
                  <p className="mt-2 text-lg font-bold text-[var(--planner-accent)]">
                    {entry.best.unitPrice?.toLocaleString("ja-JP")}/{entry.best.quantityUnit}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="planner-card">
        <SectionTitle icon={<Store size={16} />} kicker="読み取り済み商品" title="比較に使っている明細" />
        {observations.length === 0 ? (
          <EmptyState label="レシートOCRから商品名と価格を取り込むと、比較用の明細がここに並びます。" />
        ) : (
          <div className="mt-4 space-y-3">
            {observations.slice(0, 8).map((item) => (
              <div key={item.id} className="planner-row">
                <div className="planner-stamp planner-stamp-soft">¥</div>
                <div className="min-w-0 flex-1">
                  <p className="planner-wrap-text text-sm font-semibold text-[var(--planner-text)]">{item.itemName}</p>
                  <p className="planner-wrap-text text-xs text-[var(--planner-subtle)]">
                    {item.shopName || "店名未設定"} ・ {item.expenseDate}
                  </p>
                </div>
                <p className="text-sm font-bold text-[var(--planner-text)]">
                  {item.unitPrice ? `${item.unitPrice.toLocaleString("ja-JP")}/${item.quantityUnit}` : formatYen(item.totalPrice)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
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
      const ranked = rows.slice().sort((left, right) => getComparablePrice(left) - getComparablePrice(right));
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

function buildUnitComparisons(observations: ReceiptItemObservation[]) {
  return buildBargainEntries(observations).filter((entry) => Boolean(entry.best.unitPrice && entry.best.quantityUnit));
}

function getComparablePrice(observation: ReceiptItemObservation) {
  return observation.unitPrice ?? observation.totalPrice;
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-[22px] bg-[var(--planner-soft)] px-4 py-6 text-center text-sm text-[var(--planner-subtle)]">{label}</p>;
}
