// src/components/list/ListScreen.tsx

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, HeartPulse } from "lucide-react";
import * as Icons from "lucide-react";
import { db } from "@/db/database";
import { formatMonthYear, formatDateDisplay, formatYen, addMonths, getMonthRange } from "@/utils";
import type { Expense, MedicalExpense, Category, Member } from "@/types";

type Filter = "all" | "unchecked" | "medical" | "fixed";

interface DayGroup {
  date: string;
  expenses: Expense[];
  medicals: MedicalExpense[];
  total: number;
}

export default function ListScreen() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [filter, setFilter] = useState<Filter>("all");
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [medicals,   setMedicals]   = useState<MedicalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members,    setMembers]    = useState<Member[]>([]);

  const load = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    const [cats, mems, exps, meds] = await Promise.all([
      db.categories.where("isActive").equals(1).toArray(),
      db.members.where("isActive").equals(1).toArray(),
      db.expenses.where("date").between(start, end, true, false).toArray(),
      db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
    ]);
    setCategories(cats);
    setMembers(mems);
    setExpenses(exps.sort((a,b) => b.date.localeCompare(a.date)));
    setMedicals(meds.sort((a,b) => b.paymentDate.localeCompare(a.paymentDate)));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const unchecked = expenses.filter(e=>!e.isChecked).length + medicals.filter(m=>!m.isChecked).length;

  // フィルタ適用
  const filteredExp = expenses.filter(e => {
    if (filter === "unchecked") return !e.isChecked;
    if (filter === "medical")   return false;
    if (filter === "fixed")     return e.isFixed;
    return true;
  });
  const filteredMed = (filter === "all" || filter === "medical" || filter === "unchecked")
    ? medicals.filter(m => filter === "unchecked" ? !m.isChecked : true)
    : [];

  // 日付グループを作る
  const groups: DayGroup[] = (() => {
    const map: Record<string, DayGroup> = {};
    for (const e of filteredExp) {
      if (!map[e.date]) map[e.date] = { date: e.date, expenses: [], medicals: [], total: 0 };
      map[e.date].expenses.push(e);
      map[e.date].total += e.amount;
    }
    for (const m of filteredMed) {
      const d = m.paymentDate;
      if (!map[d]) map[d] = { date: d, expenses: [], medicals: [], total: 0 };
      map[d].medicals.push(m);
      map[d].total += m.amount;
    }
    return Object.values(map).sort((a,b) => b.date.localeCompare(a.date));
  })();

  const toggleExpense = async (id: string) => {
    const e = await db.expenses.get(id);
    if (e) { await db.expenses.update(id, { isChecked: !e.isChecked }); load(); }
  };
  const toggleMedical = async (id: string) => {
    const m = await db.medicalExpenses.get(id);
    if (m) { await db.medicalExpenses.update(id, { isChecked: !m.isChecked }); load(); }
  };
  const deleteExpense = async (id: string) => {
    if (confirm("この支出を削除しますか？")) { await db.expenses.delete(id); load(); }
  };
  const deleteMedical = async (id: string) => {
    if (confirm("この医療費を削除しますか？")) { await db.medicalExpenses.delete(id); load(); }
  };

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() ||
       (next.year === today.getFullYear() && next.month > today.getMonth()+1)) return;
    setYear(next.year); setMonth(next.month);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 月切替 */}
      <div className="flex items-center justify-between px-4 py-3 bg-app-bg">
        <button onClick={() => goMonth(-1)} className="p-2"><ChevronLeft size={22} color="#3B7DD8"/></button>
        <h2 className="text-lg font-bold">{formatMonthYear(year, month)}</h2>
        <button onClick={() => goMonth(1)} className="p-2"
          disabled={year===today.getFullYear() && month===today.getMonth()+1}>
          <ChevronRight size={22} color={year===today.getFullYear()&&month===today.getMonth()+1?"#ccc":"#3B7DD8"}/>
        </button>
      </div>

      {/* フィルタタブ */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-app-bg">
        {(["all","unchecked","medical","fixed"] as Filter[]).map(f => {
          const labels = { all:"すべて", unchecked:"未確認", medical:"医療費", fixed:"固定費" };
          const sel = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
                ${sel ? "text-accent" : "bg-white text-gray-500"}`}
              style={sel ? {backgroundColor:"#3B7DD8"+"18", color:"#3B7DD8"} : {}}>
              {labels[f]}
              {f === "unchecked" && unchecked > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unchecked}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <Icons.Inbox size={40} />
            <p className="text-sm">この月の支出はありません</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.date}>
              {/* 日付ヘッダー */}
              <div className="flex justify-between items-center px-4 py-2 bg-app-bg sticky top-0 z-10">
                <span className="text-xs font-bold text-gray-400">{formatDateDisplay(group.date)}</span>
                <span className="text-xs font-bold text-gray-400">合計 {formatYen(group.total)}</span>
              </div>

              {/* 支出行 */}
              {group.expenses.map(e => {
                const cat = categories.find(c => c.id === e.categoryId);
                const mem = members.find(m => m.id === e.memberId);
                const IconComp = cat ? (Icons as any)[cat.icon] ?? Icons.MoreHorizontal : Icons.MoreHorizontal;
                return (
                  <div key={e.id}
                    className={`flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-50
                      active:bg-gray-50 transition-opacity ${e.isChecked ? "opacity-50" : ""}`}
                    onClick={() => toggleExpense(e.id)}
                    onContextMenu={ev => { ev.preventDefault(); deleteExpense(e.id); }}>
                    {e.isChecked
                      ? <CheckCircle2 size={24} color="#3DB87C" className="shrink-0"/>
                      : <Circle size={24} color="#ddd" className="shrink-0"/>}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                         style={{backgroundColor: (cat?.colorHex ?? "#ccc")+"22"}}>
                      <IconComp size={16} color={cat?.colorHex ?? "#ccc"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${e.isChecked ? "line-through text-gray-400" : ""}`}>
                        {e.shopName ?? (e.memo || "（店舗未設定）")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {mem?.shortName}{cat ? `　${cat.name}` : ""}
                      </p>
                    </div>
                    <p className={`text-base font-bold shrink-0 ${e.isChecked ? "text-gray-400" : ""}`}>
                      {formatYen(e.amount)}
                    </p>
                  </div>
                );
              })}

              {/* 医療費行 */}
              {group.medicals.map(m => {
                const mem = members.find(mb => mb.id === m.memberId);
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-50
                      active:bg-gray-50 transition-opacity ${m.isChecked ? "opacity-50" : ""}`}
                    onClick={() => toggleMedical(m.id)}
                    onContextMenu={ev => { ev.preventDefault(); deleteMedical(m.id); }}>
                    {m.isChecked
                      ? <CheckCircle2 size={24} color="#3DB87C" className="shrink-0"/>
                      : <Circle size={24} color="#ddd" className="shrink-0"/>}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                      <HeartPulse size={16} color="#E05C5C" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${m.isChecked ? "line-through text-gray-400" : ""}`}>
                        {m.hospitalName ?? "病院未設定"}
                      </p>
                      <p className="text-xs" style={{color:"#E05C5C"}}>
                        {mem?.shortName}　{m.isTransportation ? "通院交通費" : m.medicalType}
                      </p>
                    </div>
                    <p className={`text-base font-bold shrink-0 ${m.isChecked ? "text-gray-400" : ""}`}
                       style={m.isChecked ? {} : {color:"#E05C5C"}}>
                      {formatYen(m.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
