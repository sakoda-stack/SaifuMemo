// src/components/home/HomeScreen.tsx

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import * as Icons from "lucide-react";
import { db } from "@/db/database";
import { formatMonthYear, formatYen, addMonths, getMonthRange } from "@/utils";
import type { Expense, MedicalExpense, Member, Category, CategoryTotal } from "@/types";

export default function HomeScreen() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [showAllCats, setShowAllCats] = useState(false);

  const [members,    setMembers]    = useState<Member[]>([]);
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [medicals,   setMedicals]   = useState<MedicalExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [yearMedTotal, setYearMedTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { start, end } = getMonthRange(year, month);
      const [mems, cats, exps, meds, allMed] = await Promise.all([
        db.members.where("isActive").equals(1).sortBy("sortOrder"),
        db.categories.where("isActive").equals(1).sortBy("sortOrder"),
        db.expenses.where("date").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("paymentDate").between(start, end, true, false).toArray(),
        db.medicalExpenses.where("fiscalYear").equals(today.getFullYear()).toArray(),
      ]);
      setMembers(mems);
      setCategories(cats);
      setExpenses(memberFilter === "all" ? exps : exps.filter(e => e.memberId === memberFilter));
      setMedicals(memberFilter === "all" ? meds : meds.filter(m => m.memberId === memberFilter));
      setYearMedTotal(allMed.reduce((s,r) => s + r.amount - r.reimbursedAmount, 0));
    };
    load();
  }, [year, month, memberFilter]);

  const monthTotal = expenses.reduce((s,e) => s+e.amount, 0)
                   + medicals.reduce((s,m) => s+m.amount, 0);

  // カテゴリ別集計
  const catTotals: CategoryTotal[] = categories
    .map(cat => {
      const total = expenses
        .filter(e => e.categoryId === cat.id)
        .reduce((s,e) => s+e.amount, 0);
      return { categoryId: cat.id, name: cat.name, icon: cat.icon, color: cat.colorHex, total };
    })
    .filter(c => c.total > 0)
    .sort((a,b) => b.total - a.total);

  const displayCats = showAllCats ? catTotals : catTotals.slice(0, 4);

  // 最近の支出（日付降順5件）
  const recent = [
    ...expenses.map(e => ({ ...e, _type: "expense" as const, _date: e.date })),
    ...medicals.map(m => ({ ...m, _type: "medical" as const, _date: m.paymentDate })),
  ].sort((a,b) => b._date.localeCompare(a._date)).slice(0, 5);

  const goMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    if (next.year > today.getFullYear() ||
       (next.year === today.getFullYear() && next.month > today.getMonth()+1)) return;
    setYear(next.year); setMonth(next.month);
  };

  return (
    <div className="p-4 pb-6 space-y-4 slide-up">

      {/* 月切替 */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => goMonth(-1)} className="p-2 rounded-full active:bg-gray-100">
          <ChevronLeft size={22} color="#3B7DD8" />
        </button>
        <h2 className="text-lg font-bold">{formatMonthYear(year, month)}</h2>
        <button onClick={() => goMonth(1)} className="p-2 rounded-full active:bg-gray-100"
          disabled={year===today.getFullYear() && month===today.getMonth()+1}>
          <ChevronRight size={22}
            color={year===today.getFullYear() && month===today.getMonth()+1 ? "#ccc" : "#3B7DD8"} />
        </button>
      </div>

      {/* 合計金額カード */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 mb-1">今月の支出合計</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatYen(monthTotal)}</p>
      </div>

      {/* 医療費アラート */}
      {yearMedTotal >= 100_000 && (
        <div className="bg-red-50 rounded-2xl p-4 flex items-start gap-3 border border-red-200">
          <AlertTriangle size={18} color="#E05C5C" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-500">今年の医療費: {formatYen(yearMedTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">10万円を超えました。確定申告で控除できます</p>
          </div>
        </div>
      )}

      {/* 人別フィルタ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{id:"all", shortName:"全員"}, ...members].map(m => (
          <button key={m.id}
            onClick={() => setMemberFilter(m.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all
              ${memberFilter===m.id ? "text-white" : "bg-white text-gray-500"}`}
            style={memberFilter===m.id ? {backgroundColor:"#3B7DD8"} : {}}>
            {m.shortName}
          </button>
        ))}
      </div>

      {/* カテゴリ別集計 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-400 mb-3">カテゴリ別</p>
        {displayCats.length === 0
          ? <p className="text-sm text-gray-400 text-center py-4">支出がありません</p>
          : displayCats.map(cat => (
            <CategoryBar key={cat.categoryId} cat={cat} total={monthTotal} />
          ))
        }
        {catTotals.length > 4 && (
          <button onClick={() => setShowAllCats(!showAllCats)}
            className="w-full text-center text-sm font-semibold mt-2"
            style={{color:"#3B7DD8"}}>
            {showAllCats ? "折りたたむ ∧" : "もっと見る ∨"}
          </button>
        )}
      </div>

      {/* 最近の支出 */}
      <div>
        <p className="text-xs font-bold text-gray-400 mb-3">最近の支出</p>
        <div className="space-y-2">
          {recent.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-2xl">支出がありません</p>
            : recent.map(item => (
              <RecentRow
                key={item.id}
                item={item as any}
                categories={categories}
                members={members}
              />
            ))
          }
        </div>
      </div>
    </div>
  );
}

// カテゴリバー
function CategoryBar({ cat, total }: { cat: CategoryTotal; total: number }) {
  const ratio = total > 0 ? cat.total / total : 0;
  const IconComp = (Icons as any)[cat.icon] ?? Icons.MoreHorizontal;
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
           style={{backgroundColor: cat.color+"22"}}>
        <IconComp size={16} color={cat.color} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-semibold">{cat.name}</span>
          <span className="text-sm font-bold" style={{color:cat.color}}>{formatYen(cat.total)}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
               style={{width:`${ratio*100}%`, backgroundColor: cat.color}} />
        </div>
      </div>
    </div>
  );
}

// 最近の支出行
function RecentRow({ item, categories, members }: {
  item: any; categories: Category[]; members: Member[];
}) {
  const isMed = "paymentDate" in item;
  const cat = categories.find(c => c.id === item.categoryId);
  const member = members.find(m => m.id === item.memberId);
  const IconComp = isMed ? Icons.HeartPulse : (cat ? (Icons as any)[cat.icon] ?? Icons.MoreHorizontal : Icons.MoreHorizontal);
  const color = isMed ? "#E05C5C" : (cat?.colorHex ?? "#6B7280");
  const bgColor = isMed ? "#FDEAEA" : (cat?.colorHex ?? "#6B7280") + "22";

  return (
    <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
           style={{backgroundColor: bgColor}}>
        <IconComp size={18} color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {isMed ? "医療費" : (item.shopName ?? item.memo) || "（未設定）"}
        </p>
        <p className="text-xs text-gray-400">
          {member?.shortName}{isMed ? "　医療費" : cat ? `　${cat.name}` : ""}
        </p>
      </div>
      <p className="text-base font-bold shrink-0">{formatYen(item.amount)}</p>
    </div>
  );
}
