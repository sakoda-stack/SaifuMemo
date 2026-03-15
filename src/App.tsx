import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  HeartPulse,
  Home,
  List,
  NotebookPen,
  Plus,
  Settings,
  Store,
} from "lucide-react";
import AddExpenseModal from "@/components/add/AddExpenseModal";
import AddMedicalModal from "@/components/add/AddMedicalModal";
import CalendarScreen from "@/components/calendar/CalendarScreen";
import CompareScreen from "@/components/compare/CompareScreen";
import HomeScreen from "@/components/home/HomeScreen";
import ListScreen from "@/components/list/ListScreen";
import MedicalScreen from "@/components/medical/MedicalScreen";
import MoreScreen from "@/components/more/MoreScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { generateFixedRecords, seedIfNeeded } from "@/db/database";
import { todayString } from "@/utils";

type Page = "home" | "list" | "calendar" | "more" | "compare" | "medical" | "settings";
type AddFlow = "expense-manual" | "expense-receipt" | "medical-manual" | "medical-receipt" | null;

const PAGE_META: Record<Page, { title: string; description: string }> = {
  home: { title: "今月の家計ポータル", description: "今月の状況と次の操作を短いスクロールで確認します。" },
  list: { title: "記録一覧", description: "日付ごとに整理した支出と医療費を確認します。" },
  calendar: { title: "カレンダー", description: "上部カレンダーから日別確認と入力へつなげます。" },
  more: { title: "その他", description: "分析、医療費、設定などの補助機能をまとめています。" },
  compare: { title: "スーパー分析", description: "各スーパーで安い商品を商品別に見比べます。" },
  medical: { title: "医療費ダッシュボード", description: "年間の医療費、補填後金額、対象者別の動きを確認します。" },
  settings: { title: "設定", description: "データや OCR 周りの設定を整理します。" },
};

const BOTTOM_NAV = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "list", label: "記録", icon: List },
  { id: "add", label: "追加", icon: Plus },
  { id: "calendar", label: "カレンダー", icon: CalendarDays },
  { id: "more", label: "その他", icon: NotebookPen },
] as const;

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addFlow, setAddFlow] = useState<AddFlow>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordDate, setRecordDate] = useState(todayString());

  useEffect(() => {
    void seedIfNeeded();
    void generateFixedRecords();
  }, []);

  const onSaved = () => {
    setAddFlow(null);
    setShowAddMenu(false);
    setRefreshKey((current) => current + 1);
  };

  const openAddMenu = (date?: string) => {
    setRecordDate(date ?? todayString());
    setShowAddMenu(true);
  };

  const openAddFlow = (flow: Exclude<AddFlow, null>, date?: string) => {
    setRecordDate(date ?? todayString());
    setShowAddMenu(false);
    setAddFlow(flow);
  };

  const currentBottomTab = useMemo(() => {
    if (page === "compare" || page === "medical" || page === "settings") {
      return "more";
    }

    return page;
  }, [page]);

  return (
    <div className="min-h-screen bg-[var(--planner-bg)] text-[var(--planner-text)]">
      <div className="planner-backdrop" />
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-[760px] flex-col"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
        }}
      >
        <header className="planner-app-bar">
          <div className="min-w-0 flex-1">
            <p className="planner-app-bar-kicker">SaifuMemo</p>
            <h1 className="planner-app-bar-title">{PAGE_META[page].title}</h1>
            <p className="planner-app-bar-description">{PAGE_META[page].description}</p>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-1">
          <div className="planner-sheet">
            {page === "home" ? (
              <HomeScreen
                key={refreshKey}
                onOpenList={() => setPage("list")}
                onOpenCalendar={() => setPage("calendar")}
                onOpenCompare={() => setPage("compare")}
                onOpenMedicalDashboard={() => setPage("medical")}
                onOpenExpenseManual={(date) => openAddFlow("expense-manual", date)}
                onOpenExpenseReceipt={(date) => openAddFlow("expense-receipt", date)}
                onOpenMedicalManual={(date) => openAddFlow("medical-manual", date)}
                onOpenMedicalReceipt={(date) => openAddFlow("medical-receipt", date)}
              />
            ) : null}
            {page === "list" ? <ListScreen key={refreshKey} /> : null}
            {page === "calendar" ? (
              <CalendarScreen
                key={refreshKey}
                onAddExpense={(date) => openAddFlow("expense-manual", date)}
                onAddMedical={(date) => openAddFlow("medical-manual", date)}
                onAddExpenseReceipt={(date) => openAddFlow("expense-receipt", date)}
                onAddMedicalReceipt={(date) => openAddFlow("medical-receipt", date)}
              />
            ) : null}
            {page === "more" ? (
              <MoreScreen
                onOpenCompare={() => setPage("compare")}
                onOpenMedical={() => setPage("medical")}
                onOpenSettings={() => setPage("settings")}
              />
            ) : null}
            {page === "compare" ? <CompareScreen key={refreshKey} /> : null}
            {page === "medical" ? <MedicalScreen key={refreshKey} /> : null}
            {page === "settings" ? <SettingsScreen key={refreshKey} /> : null}
          </div>
        </main>

        <nav className="planner-bottom-nav" aria-label="main navigation">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = currentBottomTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "add") {
                    openAddMenu();
                    return;
                  }

                  setPage(item.id as Page);
                }}
                className={`planner-bottom-tab ${isActive ? "planner-bottom-tab-active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {showAddMenu ? (
        <div className="planner-overlay" onClick={() => setShowAddMenu(false)}>
          <div className="planner-overlay-backdrop" />
          <div className="planner-sheet-menu" onClick={(event) => event.stopPropagation()}>
            <div className="planner-sheet-handle" />
            <p className="planner-kicker">ADD</p>
            <h2 className="planner-section-title">入力方法を選ぶ</h2>
            <div className="mt-4 grid gap-3">
              <button type="button" className="planner-choice" onClick={() => openAddFlow("expense-manual", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                  <NotebookPen size={18} />
                </span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">手入力で支出を追加</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">金額、カテゴリ、店舗をすぐ記録</span>
                </span>
              </button>
              <button type="button" className="planner-choice" onClick={() => openAddFlow("expense-receipt", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                  <Store size={18} />
                </span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">レシートから支出を追加</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">OCR 結果を確認して商品行まで反映</span>
                </span>
              </button>
              <button type="button" className="planner-choice" onClick={() => openAddFlow("medical-manual", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                  <HeartPulse size={18} />
                </span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">手入力で医療費を追加</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">家族、補填額、医療区分を整理して保存</span>
                </span>
              </button>
              <button type="button" className="planner-choice" onClick={() => openAddFlow("medical-receipt", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                  <HeartPulse size={18} />
                </span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">レシートから医療費を追加</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">病院名、薬候補、区分候補を確認して反映</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addFlow === "expense-manual" || addFlow === "expense-receipt" ? (
        <AddExpenseModal
          initialDate={recordDate}
          initialMode={addFlow === "expense-manual" ? "manual" : "receipt"}
          onClose={() => setAddFlow(null)}
          onSaved={onSaved}
        />
      ) : null}

      {addFlow === "medical-manual" || addFlow === "medical-receipt" ? (
        <AddMedicalModal
          initialDate={recordDate}
          initialMode={addFlow === "medical-manual" ? "manual" : "receipt"}
          onClose={() => setAddFlow(null)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
