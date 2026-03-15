import { useEffect, useState } from "react";
import { Calendar, HeartPulse, List, NotebookPen, Settings, Wallet } from "lucide-react";
import { generateFixedRecords, seedIfNeeded } from "@/db/database";
import AddExpenseModal from "@/components/add/AddExpenseModal";
import AddMedicalModal from "@/components/add/AddMedicalModal";
import CalendarScreen from "@/components/calendar/CalendarScreen";
import HomeScreen from "@/components/home/HomeScreen";
import ListScreen from "@/components/list/ListScreen";
import MedicalScreen from "@/components/medical/MedicalScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";

type Tab = "home" | "list" | "calendar" | "medical" | "settings";

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  { id: "home", label: "今日の家計", icon: <Wallet size={18} /> },
  { id: "list", label: "支出一覧", icon: <List size={18} /> },
  { id: "calendar", label: "カレンダー", icon: <Calendar size={18} /> },
  { id: "medical", label: "医療費", icon: <HeartPulse size={18} /> },
  { id: "settings", label: "整える", icon: <Settings size={18} /> },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMedical, setShowAddMedical] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    seedIfNeeded();
    generateFixedRecords();
  }, []);

  const onSaved = () => {
    setShowAddExpense(false);
    setShowAddMedical(false);
    setRefreshKey((current) => current + 1);
  };

  const screens: Record<Tab, JSX.Element> = {
    home: <HomeScreen key={refreshKey} />,
    list: <ListScreen key={refreshKey} />,
    calendar: <CalendarScreen key={refreshKey} />,
    medical: <MedicalScreen key={refreshKey} />,
    settings: <SettingsScreen key={refreshKey} />,
  };
  const showFab = !showAddMenu && !showAddExpense && !showAddMedical && tab !== "settings";

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
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
          <div className="planner-sheet">{screens[tab]}</div>
        </main>

        {showFab && (
          <button
            type="button"
            onClick={() => setShowAddMenu(true)}
            className="planner-fab"
            aria-label="記録を追加"
          >
            <NotebookPen size={22} />
            <span>記録する</span>
          </button>
        )}
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
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setShowAddExpense(true);
                }}
                className="planner-choice"
              >
                <span className="planner-choice-icon bg-[rgba(106,132,195,0.14)] text-[var(--planner-accent)]">🧺</span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">ふだんの支出</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">食費や日用品など、毎日の家計簿</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setShowAddMedical(true);
                }}
                className="planner-choice"
              >
                <span className="planner-choice-icon bg-[rgba(212,106,106,0.14)] text-[var(--planner-danger)]">🏥</span>
                <span>
                  <strong className="block text-sm text-[var(--planner-text)]">医療費</strong>
                  <span className="text-xs text-[var(--planner-subtle)]">通院分や薬代を控除用に整理</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onSaved={onSaved} />}
      {showAddMedical && <AddMedicalModal onClose={() => setShowAddMedical(false)} onSaved={onSaved} />}
    </div>
  );
}
