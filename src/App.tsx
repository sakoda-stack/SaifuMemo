import { useEffect, useState } from "react";
import { Calendar, HeartPulse, List, NotebookPen, Settings, Store, Wallet } from "lucide-react";
import { generateFixedRecords, seedIfNeeded } from "@/db/database";
import AddExpenseModal from "@/components/add/AddExpenseModal";
import AddMedicalModal from "@/components/add/AddMedicalModal";
import CalendarScreen from "@/components/calendar/CalendarScreen";
import CompareScreen from "@/components/compare/CompareScreen";
import HomeScreen from "@/components/home/HomeScreen";
import ListScreen from "@/components/list/ListScreen";
import MedicalScreen from "@/components/medical/MedicalScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { todayString } from "@/utils";

type Tab = "home" | "compare" | "list" | "calendar" | "medical" | "settings";

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  { id: "home", label: "ホーム", icon: <Wallet size={18} /> },
  { id: "compare", label: "比較", icon: <Store size={18} /> },
  { id: "list", label: "一覧", icon: <List size={18} /> },
  { id: "calendar", label: "カレンダー", icon: <Calendar size={18} /> },
  { id: "medical", label: "医療費", icon: <HeartPulse size={18} /> },
  { id: "settings", label: "設定", icon: <Settings size={18} /> },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMedical, setShowAddMedical] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordDate, setRecordDate] = useState(todayString());

  useEffect(() => {
    seedIfNeeded();
    generateFixedRecords();
  }, []);

  const onSaved = () => {
    setShowAddExpense(false);
    setShowAddMedical(false);
    setShowAddMenu(false);
    setRefreshKey((current) => current + 1);
  };

  const openAddMenu = (date?: string) => {
    setRecordDate(date ?? todayString());
    setShowAddMenu(true);
  };

  const openExpenseModal = (date?: string) => {
    setRecordDate(date ?? todayString());
    setShowAddMenu(false);
    setShowAddExpense(true);
  };

  const openMedicalModal = (date?: string) => {
    setRecordDate(date ?? todayString());
    setShowAddMenu(false);
    setShowAddMedical(true);
  };

  const screens: Record<Tab, JSX.Element> = {
    home: <HomeScreen key={refreshKey} />,
    compare: <CompareScreen key={refreshKey} />,
    list: <ListScreen key={refreshKey} />,
    calendar: <CalendarScreen key={refreshKey} onAddExpense={openExpenseModal} onAddMedical={openMedicalModal} />,
    medical: <MedicalScreen key={refreshKey} />,
    settings: <SettingsScreen key={refreshKey} />,
  };

  const showRecordAction = !showAddMenu && !showAddExpense && !showAddMedical && tab !== "settings";

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--planner-bg)]">
      <div className="planner-backdrop" />
      <div
        className="relative flex min-h-screen w-full flex-col px-3 pb-6 pt-3"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        <header className="sticky top-0 z-30 pb-3">
          <div className="planner-tabs">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`planner-tab ${tab === item.id ? "planner-tab-active" : ""}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {showRecordAction && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => openAddMenu()}
                className="planner-header-action"
                aria-label="記録を追加"
              >
                <NotebookPen size={18} />
                <span>記録する</span>
              </button>
            </div>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="planner-sheet">{screens[tab]}</div>
        </main>
      </div>

      {showAddMenu && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={() => setShowAddMenu(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative mx-3 mb-3 w-[calc(100%-24px)] rounded-[28px] border border-[var(--planner-line)] bg-[var(--planner-paper)] p-5 shadow-[0_18px_60px_rgba(78,64,52,0.18)] fade-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--planner-line)]" />
            <p className="planner-kicker text-center">新しく記録する</p>
            <div className="mt-4 grid gap-3">
              <button type="button" onClick={() => openExpenseModal(recordDate)} className="planner-choice">
                <span className="planner-choice-icon bg-[rgba(106,132,195,0.14)] text-[var(--planner-accent)]">🛒</span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">ふだんの支出</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">買い物や日用品などの家計記録</span>
                </span>
              </button>
              <button type="button" onClick={() => openMedicalModal(recordDate)} className="planner-choice">
                <span className="planner-choice-icon bg-[rgba(212,106,106,0.14)] text-[var(--planner-danger)]">🏥</span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">医療費</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">病院代や薬代、通院交通費をまとめる</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddExpense && <AddExpenseModal initialDate={recordDate} onClose={() => setShowAddExpense(false)} onSaved={onSaved} />}
      {showAddMedical && <AddMedicalModal initialDate={recordDate} onClose={() => setShowAddMedical(false)} onSaved={onSaved} />}
    </div>
  );
}
