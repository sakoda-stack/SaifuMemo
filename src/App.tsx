// src/App.tsx
// タブナビゲーションのルート
// PWAなのでReact Routerは使わず、シンプルなstateで切り替える

import { useState, useEffect } from "react";
import { Home, List, Plus, HeartPulse, Settings } from "lucide-react";
import { seedIfNeeded, generateFixedRecords } from "@/db/database";
import HomeScreen    from "@/components/home/HomeScreen";
import ListScreen    from "@/components/list/ListScreen";
import MedicalScreen from "@/components/medical/MedicalScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";
import AddExpenseModal  from "@/components/add/AddExpenseModal";
import AddMedicalModal  from "@/components/add/AddMedicalModal";

type Tab = "home" | "list" | "medical" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMedical, setShowAddMedical] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // 保存後に画面をリフレッシュする

  // 初回起動時の初期化
  useEffect(() => {
    seedIfNeeded();
    generateFixedRecords();
  }, []);

  const onSaved = () => {
    setShowAddExpense(false);
    setShowAddMedical(false);
    setRefreshKey(k => k + 1); // 画面を再読み込み
  };

  const screens: Record<Tab, JSX.Element> = {
    home:     <HomeScreen    key={refreshKey} />,
    list:     <ListScreen    key={refreshKey} />,
    medical:  <MedicalScreen key={refreshKey} />,
    settings: <SettingsScreen key={refreshKey} />,
  };

  return (
    // iPhoneのノッチ・ホームバーに対応したレイアウト
    <div className="flex flex-col h-screen max-w-md mx-auto bg-app-bg"
         style={{ paddingTop: "env(safe-area-inset-top)" }}>

      {/* ── メインコンテンツ（スクロール可） ── */}
      <main className="flex-1 overflow-y-auto">
        {screens[tab]}
      </main>

      {/* ── タブバー ── */}
      <nav className="bg-white border-t border-gray-200 flex items-end relative"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>

        <TabItem icon={<Home size={22}/>}       label="ホーム"   active={tab==="home"}     onClick={() => setTab("home")} />
        <TabItem icon={<List size={22}/>}       label="明細"     active={tab==="list"}     onClick={() => setTab("list")} />

        {/* 中央の＋ボタン */}
        <div className="flex-1 flex justify-center items-center pb-1">
          <button
            onClick={() => setShowAddMenu(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-5"
            style={{ backgroundColor: "#3B7DD8", boxShadow: "0 4px 14px rgba(59,125,216,0.5)" }}
          >
            <Plus size={28} color="white" strokeWidth={2.5} />
          </button>
        </div>

        <TabItem icon={<HeartPulse size={22}/>} label="医療費"   active={tab==="medical"}  onClick={() => setTab("medical")} />
        <TabItem icon={<Settings size={22}/>}   label="設定"     active={tab==="settings"} onClick={() => setTab("settings")} />
      </nav>

      {/* ── 追加メニュー（モーダル） ── */}
      {showAddMenu && (
        <div className="fixed inset-0 z-40 flex items-end justify-center"
             onClick={() => setShowAddMenu(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl pb-10 pt-4 px-6 fade-in"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-center text-sm text-gray-500 font-semibold mb-4">何を追加しますか？</p>
            <button
              onClick={() => { setShowAddMenu(false); setShowAddExpense(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-50 mb-3 active:bg-gray-100"
            >
              <span className="text-2xl">💰</span>
              <span className="text-base font-semibold">通常の支出を追加</span>
            </button>
            <button
              onClick={() => { setShowAddMenu(false); setShowAddMedical(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 active:bg-red-100"
            >
              <span className="text-2xl">🏥</span>
              <span className="text-base font-semibold text-red-600">医療費を追加</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 追加フォームモーダル ── */}
      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSaved={onSaved}
        />
      )}
      {showAddMedical && (
        <AddMedicalModal
          onClose={() => setShowAddMedical(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// タブアイテム
function TabItem({ icon, label, active, onClick }: {
  icon: JSX.Element; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex-1 flex flex-col items-center justify-end pb-2 pt-1 gap-0.5">
      <span style={{ color: active ? "#3B7DD8" : "#888899" }}>{icon}</span>
      <span className="text-[10px] font-semibold"
            style={{ color: active ? "#3B7DD8" : "#888899" }}>{label}</span>
    </button>
  );
}
