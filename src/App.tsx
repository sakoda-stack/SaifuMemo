import { useEffect, useMemo, useState } from "react";
import { CalendarDays, HeartPulse, Home, List, NotebookPen, Plus, Settings } from "lucide-react";
import AddExpenseModal from "@/components/add/AddExpenseModal";
import AddMedicalModal from "@/components/add/AddMedicalModal";
import CalendarScreen from "@/components/calendar/CalendarScreen";
import HomeScreen from "@/components/home/HomeScreen";
import ListScreen from "@/components/list/ListScreen";
import MedicalScreen from "@/components/medical/MedicalScreen";
import MoreScreen from "@/components/more/MoreScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { generateFixedRecords, seedIfNeeded } from "@/db/database";
import { todayString } from "@/utils";

type Page = "home" | "list" | "calendar" | "more" | "medical" | "settings";
type AddFlow = "expense-manual" | "medical-manual" | null;

const PAGE_TITLE: Record<Page, string> = {
  home: "今月の家計",
  list: "記録一覧",
  calendar: "カレンダー",
  more: "その他",
  medical: "医療費",
  settings: "設定",
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
    if (page === "medical" || page === "settings") {
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
            <h1 className="planner-app-bar-title">{PAGE_TITLE[page]}</h1>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-1">
          <div className="planner-sheet">
            {page === "home" ? (
              <HomeScreen
                key={refreshKey}
                onOpenList={() => setPage("list")}
                onOpenCalendar={() => setPage("calendar")}
                onOpenMedicalDashboard={() => setPage("medical")}
                onOpenExpenseManual={(date) => openAddFlow("expense-manual", date)}
                onOpenMedicalManual={(date) => openAddFlow("medical-manual", date)}
              />
            ) : null}
            {page === "list" ? <ListScreen key={refreshKey} /> : null}
            {page === "calendar" ? (
              <CalendarScreen
                key={refreshKey}
                onAddExpense={(date) => openAddFlow("expense-manual", date)}
                onAddMedical={(date) => openAddFlow("medical-manual", date)}
              />
            ) : null}
            {page === "more" ? (
              <MoreScreen onOpenMedical={() => setPage("medical")} onOpenSettings={() => setPage("settings")} />
            ) : null}
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
            <div className="grid gap-3">
              <button type="button" className="planner-choice" onClick={() => openAddFlow("expense-manual", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                  <NotebookPen size={18} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm text-[var(--planner-text)]">支出を追加</strong>
                </span>
              </button>
              <button type="button" className="planner-choice" onClick={() => openAddFlow("medical-manual", recordDate)}>
                <span className="planner-choice-icon bg-[rgba(184,78,65,0.12)] text-[var(--planner-danger)]">
                  <HeartPulse size={18} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm text-[var(--planner-text)]">医療費を追加</strong>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addFlow === "expense-manual" ? <AddExpenseModal initialDate={recordDate} onClose={() => setAddFlow(null)} onSaved={onSaved} /> : null}

      {addFlow === "medical-manual" ? <AddMedicalModal initialDate={recordDate} onClose={() => setAddFlow(null)} onSaved={onSaved} /> : null}
    </div>
  );
}
