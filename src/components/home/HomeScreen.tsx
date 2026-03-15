import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  List,
  NotebookPen,
  ReceiptText,
  ScanText,
  Store,
} from "lucide-react";
import { db } from "@/db/database";
import { ActionCard, DataBadge, EmptyState, SectionHeader } from "@/components/ui/PlannerUI";
import { buildProductComparisons, buildStoreSummaries } from "@/utils/compare";
import { addMonths, compactYen, formatMonthYear, formatYen, getMonthRange, sumBy } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import type { Category, Expense, FixedExpenseRecord, FixedExpenseTemplate, MedicalExpense, Member, ReceiptItemObservation } from "@/types";

interface HomeScreenProps {
  onOpenList: () => void;
  onOpenCalendar: () => void;
  onOpenCompare: () => void;
  onOpenMedicalDashboard: () => void;
  onOpenExpenseManual: (date?: string) => void;
  onOpenExpenseReceipt: (date?: string) => void;
  onOpenMedicalManual: (date?: string) => void;
  onOpenMedicalReceipt: (date?: string) => void;
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

export default function HomeScreen({
  onOpenList,
  onOpenCalendar,
  onOpenCompare,
  onOpenMedicalDashboard,
  onOpenExpenseManual,
  onOpenExpenseReceipt,
  onOpenMedicalManual,
  onOpenMedicalReceipt,
}: HomeScreenProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicals, setMedicals] = useState<MedicalExpense[]>([]);
  const [observations, setObservations] = useState<ReceiptItemObservation[]>([]);
  const [fixedRecords, setFixedRecords] = useState<FixedExpenseRecord[]>([]);
  const [fixedTemplates, setFixedTemplates] = useState<FixedExpenseTemplate[]>([]);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [memberRows, categoryRows, expenseRows, medicalRows, observationRows, monthFixedRecords, templateRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
        db.receiptItemObservations.where("expenseDate").between(start, end, true, false).toArray(),
        db.fixedRecords.where("[year+month]").equals([year, month]).toArray(),
        db.fixedTemplates.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      ]);

      const filteredExpenses = memberFilter === "all" ? expenseRows : expenseRows.filter((row) => row.memberId === memberFilter);
      const filteredMedicals = memberFilter === "all" ? medicalRows : medicalRows.filter((row) => row.memberId === memberFilter);
      const allowedExpenseIds = new Set(filteredExpenses.map((row) => row.id));

      setMembers(memberRows);
      setCategories(categoryRows);
      setExpenses(filteredExpenses);
      setMedicals(filteredMedicals);
      setObservations(observationRows.filter((row) => allowedExpenseIds.has(row.expenseId)));
      setFixedRecords(monthFixedRecords);
      setFixedTemplates(templateRows);
    };

    void load();
  }, [memberFilter, month, year]);

  const monthTotal = sumBy(expenses, (expense) => expense.amount);
  const medicalTotal = sumBy(medicals, (medical) => medical.amount);
  const recordCount = expenses.length + medicals.length;
  const activeDays = new Set([...expenses.map((expense) => expense.date), ...medicals.map((medical) => medical.paymentDate)]).size;
  const pendingOcrCount =
    expenses.filter((expense) => expense.receiptImageData && !expense.isChecked).length +
    medicals.filter((medical) => medical.receiptImageData && !medical.isChecked).length;
  const fixedTotal = sumBy(fixedRecords, (record) => record.actualAmount);
  const unconfirmedFixedCount = fixedRecords.filter((record) => !record.isConfirmed).length;
  const topCategories = categories
    .map((category) => ({
      ...category,
      total: sumBy(
        expenses.filter((expense) => expense.categoryId === category.id),
        (expense) => expense.amount,
      ),
    }))
    .filter((category) => category.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 4);

  const productComparisons = useMemo(() => buildProductComparisons(observations), [observations]);
  const storeSummaries = useMemo(() => buildStoreSummaries(productComparisons), [productComparisons]);

  const recentRecords = useMemo<RecentRecord[]>(() => {
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const memberMap = new Map(members.map((member) => [member.id, member]));

    return [
      ...expenses.map((expense) => {
        const category = categoryMap.get(expense.categoryId ?? "");
        const member = memberMap.get(expense.memberId ?? "");
        return {
          id: expense.id,
          date: expense.date,
          amount: expense.amount,
          title: expense.shopName || expense.memo || "支出",
          subtitle: `${member?.shortName ?? "未設定"} / ${category?.name ?? "カテゴリ未設定"}`,
          color: category?.colorHex ?? "#8f8577",
          icon: category?.icon ?? "ReceiptText",
        };
      }),
      ...medicals.map((medical) => {
        const member = memberMap.get(medical.memberId ?? "");
        return {
          id: medical.id,
          date: medical.paymentDate,
          amount: medical.amount,
          title: medical.hospitalName || "医療費",
          subtitle: `${member?.shortName ?? "未設定"} / ${medical.isTransportation ? "通院交通費" : medical.medicalType}`,
          color: "#b84e41",
          icon: "HeartPulse",
        };
      }),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6);
  }, [categories, expenses, medicals, members]);

  const topStore = storeSummaries[0];
  const topDeal = productComparisons[0];
  const fixedTemplateMap = new Map(fixedTemplates.map((template) => [template.id, template.name]));
  const leadingCategory = topCategories[0];

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
            <p className="planner-kicker">NOW</p>
            <h1 className="planner-home-title">{formatMonthYear(year, month)}</h1>
            <p className="planner-home-caption">対象者を先に選んでから、今月の数字を見る構成にしています。</p>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <HomeSummaryCard
            label="支出合計"
            value={formatYen(monthTotal)}
            tone="accent"
            sideTop={`${recordCount} 件`}
            sideBottom={leadingCategory ? `最多 ${leadingCategory.name}` : "記録なし"}
          />
          <HomeSummaryCard
            label="医療費"
            value={formatYen(medicalTotal)}
            tone="medical"
            sideTop={`${medicals.length} 件`}
            sideBottom={medicals.length > 0 ? "補填前合計" : "未記録"}
          />
          <HomeSummaryCard
            label="動きのある日"
            value={`${activeDays}日`}
            sideTop={`OCR待ち ${pendingOcrCount}`}
            sideBottom={activeDays > 0 ? "入力のある日数" : "まだ動きなし"}
          />
          <HomeSummaryCard
            label="固定費"
            value={formatYen(fixedTotal)}
            sideTop={unconfirmedFixedCount > 0 ? `未確認 ${unconfirmedFixedCount}` : "確認済み"}
            sideBottom={fixedRecords.length > 0 ? `${fixedRecords.length} 件` : "テンプレート待ち"}
          />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="QUICK ACTION" title="すぐ使う入口" description="主要動線だけを短い説明で並べます。" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ActionCard title="手入力" description="ふだんの支出をすぐ記録" icon={<NotebookPen size={18} />} tone="accent" onClick={() => onOpenExpenseManual()} />
          <ActionCard title="レシート入力" description="OCR 結果を確認して反映" icon={<ScanText size={18} />} tone="accent" onClick={() => onOpenExpenseReceipt()} />
          <ActionCard title="カレンダー" description="日付を起点に確認と追加" icon={<List size={18} />} tone="soft" onClick={onOpenCalendar} />
          <ActionCard title="医療費" description="医療費ダッシュボードへ移動" icon={<HeartPulse size={18} />} tone="medical" onClick={onOpenMedicalDashboard} />
          <ActionCard title="スーパー分析" description="各店で何が安いかを見る" icon={<Store size={18} />} tone="accent" onClick={onOpenCompare} />
          <ActionCard title="医療費を追加" description="通院分を手入力またはOCRで追加" icon={<HeartPulse size={18} />} tone="medical" onClick={() => onOpenMedicalManual()} />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="RECENT" title="最近の記録" description="直近の流れを短い行で確認できます。" />
        <div className="mt-4 space-y-3">
          {recentRecords.length === 0 ? (
            <EmptyState title="まだ記録がありません" message="今月の記録を追加すると、ここに最近の支出と医療費が並びます。" />
          ) : (
            recentRecords.map((record) => {
              const Icon = resolveIcon(record.icon, "ReceiptText");
              return (
                <div key={record.id} className="planner-summary-row">
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
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.95fr]">
        <section className="planner-card">
          <SectionHeader kicker="INSIGHT" title="補助情報" description="医療費、固定費、OCR確認待ちを短く整理します。" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="planner-note-card planner-note-card-compact">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="planner-kicker">今月の医療費</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--planner-danger)]">{formatYen(medicalTotal)}</p>
                </div>
                {medicalTotal > 0 ? <DataBadge label={`${medicals.length} 件`} tone="medical" /> : <DataBadge label="未記録" />}
              </div>
              <p className="mt-2 text-xs text-[var(--planner-subtle)]">支出とは分けて確認できます。</p>
            </div>

            <div className="planner-note-card planner-note-card-compact">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="planner-kicker">固定費</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(fixedTotal)}</p>
                </div>
                {unconfirmedFixedCount > 0 ? <DataBadge label={`未確認 ${unconfirmedFixedCount}`} tone="warning" /> : <DataBadge label="確認済み" />}
              </div>
              <p className="mt-2 text-xs text-[var(--planner-subtle)]">
                {fixedRecords
                  .slice(0, 2)
                  .map((record) => fixedTemplateMap.get(record.templateId ?? "") ?? "固定費")
                  .join(" / ") || "固定費テンプレートを設定すると今月の定例支出を一覧できます。"}
              </p>
            </div>

            <div className="planner-note-card planner-note-card-compact">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="planner-kicker">OCR 未確認</p>
                  <p className="mt-1 text-lg font-semibold">{pendingOcrCount} 件</p>
                </div>
                {pendingOcrCount > 0 ? <DataBadge label="チェック推奨" tone="warning" /> : <DataBadge label="0 件" />}
              </div>
              <p className="mt-2 text-xs text-[var(--planner-subtle)]">一覧画面からまとめて確認できます。</p>
              <button type="button" onClick={onOpenList} className="mt-2 text-xs font-semibold text-[var(--planner-accent)]">
                記録一覧を開く
              </button>
            </div>
          </div>
        </section>

        <section className="planner-card">
          <SectionHeader kicker="COMPARE" title="比較の要約" description="まずは各スーパーの強みから見せます。" />
          <div className="mt-4 space-y-3">
            {topStore ? (
              <div className="planner-note-card">
                <p className="planner-kicker">得意な店</p>
                <p className="mt-2 text-lg font-semibold">{topStore.shopName}</p>
                <p className="mt-2 text-sm text-[var(--planner-subtle)]">
                  強い商品 {topStore.strongWinCount} 件 / 勝ち筋 {topStore.winCount} 件 / 平均 {compactYen(topStore.averageWinningPrice)}
                </p>
              </div>
            ) : (
              <EmptyState title="比較データがまだ少ないです" message="レシートOCRで商品行を読み込むと、各店の得意商品を自動で整理します。" />
            )}

            {topDeal ? (
              <div className="planner-note-card">
                <p className="planner-kicker">最安メモ</p>
                <p className="mt-2 text-lg font-semibold">{topDeal.itemLabel}</p>
                <p className="mt-2 text-sm text-[var(--planner-subtle)]">
                  {topDeal.best.shopName} が最安。{topDeal.priceGap ? `${formatYen(topDeal.priceGap)} 差` : "比較対象は参考値"}
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--planner-accent)]">
                  {topDeal.comparisonBasis === "unit" && topDeal.best.quantityUnit
                    ? `${topDeal.best.comparisonPrice.toLocaleString("ja-JP")} / ${topDeal.best.quantityUnit}`
                    : formatYen(topDeal.best.comparisonPrice)}
                </p>
              </div>
            ) : null}

            <button type="button" onClick={onOpenCompare} className="planner-link-row">
              比較画面を開く
            </button>
          </div>
        </section>
      </div>

      <section className="planner-card">
        <SectionHeader kicker="HOUSEHOLD" title="今月の家計" description="カテゴリ別の支出を横幅を使って短く見せます。" />
        <div className="mt-4 space-y-3">
          {topCategories.length === 0 ? (
            <EmptyState title="まだ記録がありません" message="手入力またはレシート入力から、まずは今月の支出を追加してください。" />
          ) : (
            topCategories.map((category) => {
              const Icon = resolveIcon(category.icon, "ReceiptText");
              const ratio = monthTotal > 0 ? Math.min(100, Math.round((category.total / monthTotal) * 100)) : 0;
              return (
                <div key={category.id} className="planner-summary-row">
                  <div className="planner-summary-icon" style={{ backgroundColor: `${category.colorHex}18`, color: category.colorHex }}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{category.name}</p>
                      <p className="text-sm font-semibold">{formatYen(category.total)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="planner-bar flex-1">
                        <span className="planner-bar-fill" style={{ width: `${ratio}%`, backgroundColor: category.colorHex }} />
                      </div>
                      <span className="shrink-0 text-xs text-[var(--planner-subtle)]">{ratio}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="SHORTCUT" title="入力導線" description="日付から入るか、入力方式から入るかを選べます。" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ActionCard title="今日の支出を手入力" description="日付つきでそのまま追加" icon={<NotebookPen size={18} />} tone="accent" onClick={() => onOpenExpenseManual()} />
          <ActionCard title="今日のレシートを読む" description="商品一覧をフォームで確認" icon={<ReceiptText size={18} />} tone="accent" onClick={() => onOpenExpenseReceipt()} />
          <ActionCard title="医療費を手入力" description="家族と補填額を先に整理" icon={<HeartPulse size={18} />} tone="medical" onClick={() => onOpenMedicalManual()} />
          <ActionCard title="医療レシートを読む" description="病院名や薬候補を抽出" icon={<ScanText size={18} />} tone="medical" onClick={() => onOpenMedicalReceipt()} />
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
}: {
  label: string;
  value: string;
  sideTop: string;
  sideBottom: string;
  tone?: "default" | "accent" | "medical";
}) {
  return (
    <article className={`planner-home-summary planner-home-summary-${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="planner-kicker">{label}</p>
        <p className="planner-home-summary-value">{value}</p>
      </div>
      <div className="planner-home-summary-side">
        <span className="planner-home-summary-meta">{sideTop}</span>
        <span className="planner-home-summary-note">{sideBottom}</span>
      </div>
    </article>
  );
}
