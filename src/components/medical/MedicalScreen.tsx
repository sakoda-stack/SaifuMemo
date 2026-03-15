// src/components/medical/MedicalScreen.tsx

import { useState, useEffect } from "react";
import { db } from "@/db/database";
import { formatYen, generateMedicalCSV, downloadCSV } from "@/utils";
import type { MedicalExpense, Member, ShopMaster } from "@/types";

export default function MedicalScreen() {
  const currentYear = new Date().getFullYear();
  const [selYear,    setSelYear]    = useState(currentYear);
  const [selMember,  setSelMember]  = useState("all");
  const [records,    setRecords]    = useState<MedicalExpense[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalExpense[]>([]);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [shops,      setShops]      = useState<Map<string,string>>(new Map());

  useEffect(() => {
    const load = async () => {
      const [mems, all, hosps] = await Promise.all([
        db.members.where("isActive").equals(1).sortBy("sortOrder"),
        db.medicalExpenses.where("fiscalYear").equals(selYear).toArray(),
        db.shopMasters.toArray(),
      ]);
      setMembers(mems);
      setAllRecords(all);
      setShops(new Map(hosps.map(h => [h.id, h.name])));
      setRecords(selMember==="all" ? all : all.filter(r=>r.memberId===selMember));
    };
    load();
  }, [selYear, selMember]);

  const getMemberName = (id?: string) => members.find(m=>m.id===id)?.shortName ?? "";
  const getHospName   = (id?: string) => shops.get(id??"") ?? "";

  const total    = records.reduce((s,r)=>s+r.amount,0);
  const netTotal = records.reduce((s,r)=>s+r.amount-r.reimbursedAmount,0);
  const progress = Math.min(1, netTotal/100_000);
  const deductible = Math.max(0, netTotal-100_000);

  const doExport = () => {
    const csv = generateMedicalCSV(selYear, allRecords, getMemberName, getHospName);
    downloadCSV(csv, `医療費集計_${selYear}年度.csv`);
  };

  return (
    <div className="p-4 pb-6 space-y-4 slide-up">
      <h2 className="text-2xl font-extrabold pt-2">医療費控除</h2>

      {/* 年度切替 */}
      <div className="flex rounded-2xl overflow-hidden bg-white">
        {[currentYear, currentYear-1, currentYear-2].map(y=>(
          <button key={y} onClick={()=>setSelYear(y)}
            className="flex-1 py-2.5 text-sm font-bold transition-all"
            style={selYear===y?{backgroundColor:"#E05C5C",color:"#fff"}:{color:"#888"}}>
            {y}年度
          </button>
        ))}
      </div>

      {/* サマリーカード */}
      <div className="rounded-2xl p-5 text-white" style={{background:"linear-gradient(135deg,#C0392B,#E05C5C)"}}>
        <p className="text-sm opacity-80 mb-1">年間医療費合計（補填後）</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatYen(netTotal)}</p>
        {netTotal!==total&&<p className="text-xs opacity-75 mt-1">支払総額 {formatYen(total)}</p>}
        <div className="mt-4">
          <div className="h-3 rounded-full overflow-hidden" style={{backgroundColor:"rgba(255,255,255,0.25)"}}>
            <div className="h-full rounded-full bg-white transition-all" style={{width:`${progress*100}%`}}/>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs opacity-75">10万円ライン: ¥100,000</span>
            {deductible>0
              ? <span className="text-xs font-bold">控除対象: {formatYen(deductible)}</span>
              : <span className="text-xs opacity-75">あと {formatYen(100_000-netTotal)}</span>}
          </div>
        </div>
      </div>

      {/* 人別フィルタ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{id:"all",shortName:"全員"}, ...members].map(m=>(
          <button key={m.id} onClick={()=>setSelMember(m.id)}
            className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
            style={selMember===m.id?{backgroundColor:"#E05C5C",color:"#fff"}:{backgroundColor:"#fff",color:"#888"}}>
            {m.shortName}
          </button>
        ))}
      </div>

      {/* 明細テーブル */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="flex px-4 py-2.5" style={{backgroundColor:"#FDEAEA"}}>
          <span className="w-12 text-xs font-bold" style={{color:"#E05C5C"}}>対象者</span>
          <span className="flex-1 text-xs font-bold" style={{color:"#E05C5C"}}>病院・薬局</span>
          <span className="w-24 text-right text-xs font-bold" style={{color:"#E05C5C"}}>金額</span>
        </div>
        {records.length===0
          ? <p className="text-center text-sm text-gray-400 py-8">この年度の医療費はありません</p>
          : records.map((r,i)=>(
            <div key={r.id} className="flex items-start px-4 py-3 border-b border-gray-50"
                 style={i%2===1?{backgroundColor:"#fafafa"}:{}}>
              <span className="w-12 text-sm text-gray-500">{getMemberName(r.memberId)}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{getHospName(r.hospitalId)||"未設定"}</p>
                <p className="text-xs text-gray-400">{r.isTransportation?"通院交通費":r.medicalType}</p>
              </div>
              <span className="w-24 text-right text-sm font-bold">{formatYen(r.amount)}</span>
            </div>
          ))
        }
        {records.length>0&&(
          <div className="flex px-4 py-3" style={{backgroundColor:"#FDEAEA"}}>
            <span className="flex-1 text-right text-sm font-bold">合計</span>
            <span className="w-24 text-right text-sm font-bold" style={{color:"#E05C5C"}}>{formatYen(total)}</span>
          </div>
        )}
      </div>

      {/* CSV出力 */}
      <button onClick={doExport}
        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2"
        style={{backgroundColor:"#3B7DD8"}}>
        📊 CSV出力（国税庁フォーム対応）
      </button>
      <p className="text-xs text-center text-gray-400">
        e-Tax・マイナポータルにそのままインポートできます
      </p>
    </div>
  );
}
