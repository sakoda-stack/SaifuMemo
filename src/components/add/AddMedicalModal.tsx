// src/components/add/AddMedicalModal.tsx

import { useState, useEffect, useRef } from "react";
import { Camera, Image } from "lucide-react";
import * as Icons from "lucide-react";
import { db } from "@/db/database";
import { todayString, fileToBase64, MEDICAL_TYPES } from "@/utils";
import { v4 as uuid } from "uuid";
import type { Member, ShopMaster, MedicalType } from "@/types";

interface Props { onClose: () => void; onSaved: () => void; }

export default function AddMedicalModal({ onClose, onSaved }: Props) {
  const [members,   setMembers]   = useState<Member[]>([]);
  const [hospitals, setHospitals] = useState<ShopMaster[]>([]);
  const [selMember,  setSelMember]  = useState("");
  const [selHospital,setSelHospital]= useState("");
  const [medType,    setMedType]    = useState<MedicalType>("診療・治療");
  const [isTransport,setIsTransport]= useState(false);
  const [amount,     setAmount]     = useState("");
  const [reimbursed, setReimbursed] = useState("");
  const [date,       setDate]       = useState(todayString());
  const [imgData,    setImgData]    = useState("");
  const [newHosp,    setNewHosp]    = useState("");
  const [showNewHosp,setShowNewHosp]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [mems, hosps] = await Promise.all([
        db.members.where("isActive").equals(1).sortBy("sortOrder"),
        db.shopMasters.where("isActive").equals(1).toArray()
          .then(a => a.filter(s => s.shopType==="hospital"||s.shopType==="pharmacy")
            .sort((a,b)=>b.usageCount-a.usageCount)),
      ]);
      setMembers(mems); setHospitals(hosps);
    };
    load();
  }, []);

  const addHospital = async () => {
    if (!newHosp.trim()) return;
    const id = uuid();
    await db.shopMasters.add({ id, name: newHosp.trim(), shopType:"hospital", usageCount:0, isActive:true, createdAt:new Date() });
    setHospitals(prev => [{ id, name: newHosp.trim(), shopType:"hospital", usageCount:0, isActive:true, createdAt:new Date() }, ...prev]);
    setSelHospital(id); setNewHosp(""); setShowNewHosp(false);
  };

  const save = async () => {
    if (!selMember) { alert("医療を受けた人を選択してください"); return; }
    if (!amount || parseInt(amount)<=0) { alert("金額を入力してください"); return; }
    const hospitalName = hospitals.find(h=>h.id===selHospital)?.name;
    await db.medicalExpenses.add({
      id: uuid(), paymentDate: date,
      amount: parseInt(amount), reimbursedAmount: parseInt(reimbursed)||0,
      medicalType: isTransport ? "通院交通費" : medType,
      isTransportation: isTransport, isChecked: false,
      fiscalYear: parseInt(date.slice(0,4)),
      receiptImageData: imgData||undefined,
      memberId: selMember||undefined, hospitalId: selHospital||undefined,
      hospitalName, createdAt: new Date(),
    } as any);
    if (selHospital) await db.shopMasters.where("id").equals(selHospital).modify(s=>{s.usageCount++;});
    onSaved();
  };

  const canSave = !!selMember && parseInt(amount)>0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative w-full max-w-md bg-white rounded-t-3xl flex flex-col" style={{maxHeight:"92vh"}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400 font-semibold">キャンセル</button>
          <h3 className="text-base font-bold">医療費を追加</h3>
          <button onClick={save} disabled={!canSave} className="font-bold text-sm"
            style={{color: canSave?"#E05C5C":"#ccc"}}>保存</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* 説明バナー */}
          <div className="flex items-center gap-2 bg-red-50 rounded-2xl p-3">
            <Icons.Info size={16} color="#E05C5C"/>
            <p className="text-xs text-red-500">確定申告の医療費控除に使用するフォームです</p>
          </div>

          {/* 撮影 */}
          <div className="flex gap-3">
            <button onClick={()=>cameraRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm bg-red-50 text-red-500">
              <Camera size={18}/> 撮影
            </button>
            <button onClick={()=>fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm bg-red-50 text-red-500">
              <Image size={18}/> ライブラリ
            </button>
            {imgData&&<div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-green-50 text-green-600"><Icons.CheckCircle2 size={18}/>添付済み</div>}
          </div>
          <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&fileToBase64(e.target.files[0]).then(setImgData)}/>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&fileToBase64(e.target.files[0]).then(setImgData)}/>

          {/* 金額 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">支払った金額 <span className="text-red-400">※必須</span></label>
            <div className="flex items-center bg-gray-50 rounded-2xl px-4 border-2" style={{borderColor:"#E05C5C"}}>
              <span className="text-2xl font-bold text-gray-400 mr-2">¥</span>
              <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)}
                placeholder="0" autoFocus
                className="flex-1 text-4xl font-extrabold bg-transparent outline-none py-3 w-full"/>
            </div>
          </div>

          {/* 受診者 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">医療を受けた人 <span className="text-red-400">※必須</span></label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m=>(
                <button key={m.id} onClick={()=>setSelMember(selMember===m.id?"":m.id)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={selMember===m.id?{backgroundColor:"#E05C5C",color:"#fff"}:{backgroundColor:"#F7F6F2",color:"#374151"}}>
                  {m.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* 病院 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">病院・薬局</label>
            <div className="flex flex-wrap gap-2">
              {hospitals.map(h=>(
                <button key={h.id} onClick={()=>setSelHospital(selHospital===h.id?"":h.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                  style={selHospital===h.id?{borderColor:"#E05C5C",color:"#E05C5C",backgroundColor:"#FDEAEA"}:{borderColor:"#e5e7eb",color:"#374151"}}>
                  {h.name}
                </button>
              ))}
              <button onClick={()=>setShowNewHosp(!showNewHosp)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2"
                style={{borderColor:"#E05C5C",color:"#E05C5C",backgroundColor:"#FDEAEA"}}>＋追加</button>
            </div>
            {showNewHosp&&(
              <div className="flex gap-2 mt-2">
                <input value={newHosp} onChange={e=>setNewHosp(e.target.value)} placeholder="病院名・薬局名"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none"/>
                <button onClick={addHospital} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500">追加</button>
              </div>
            )}
          </div>

          {/* 通院交通費トグル */}
          <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
            <span className="text-sm font-semibold">通院交通費として登録する</span>
            <button onClick={()=>setIsTransport(!isTransport)}
              className="w-12 h-7 rounded-full transition-all flex items-center px-1"
              style={{backgroundColor:isTransport?"#3B7DD8":"#d1d5db"}}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isTransport?"translate-x-5":""}`}/>
            </button>
          </div>

          {/* 医療費区分 */}
          {!isTransport&&(
            <div className="space-y-2">
              {MEDICAL_TYPES.map(t=>(
                <button key={t} onClick={()=>setMedType(t)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={medType===t?{backgroundColor:"#FDEAEA"}:{backgroundColor:"#F7F6F2"}}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${medType===t?"border-red-400":"border-gray-300"}`}>
                    {medType===t&&<div className="w-2.5 h-2.5 rounded-full bg-red-400"/>}
                  </div>
                  <span className="text-sm font-medium" style={medType===t?{color:"#E05C5C"}:{}}>{t}</span>
                </button>
              ))}
            </div>
          )}

          {/* 補填金額 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">補填される金額（保険・高額療養費等）</label>
            <div className="flex items-center bg-gray-50 rounded-2xl px-4 border border-gray-200">
              <span className="text-lg font-bold text-gray-400 mr-2">¥</span>
              <input type="number" inputMode="numeric" value={reimbursed} onChange={e=>setReimbursed(e.target.value)}
                placeholder="0" className="flex-1 text-xl font-bold bg-transparent outline-none py-2.5"/>
            </div>
            <p className="text-xs text-gray-400 mt-1">※ 受け取った保険金・高額療養費がある場合に入力</p>
          </div>

          {/* 日付 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">支払日</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm outline-none"/>
          </div>

          <button onClick={save} disabled={!canSave}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg"
            style={{backgroundColor:canSave?"#E05C5C":"#d1d5db"}}>
            保存する
          </button>
          <div className="h-6"/>
        </div>
      </div>
    </div>
  );
}
