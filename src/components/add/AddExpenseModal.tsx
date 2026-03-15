// src/components/add/AddExpenseModal.tsx

import { useState, useRef, useEffect } from "react";
import { X, Camera, Image } from "lucide-react";
import * as Icons from "lucide-react";
import { db } from "@/db/database";
import { todayString, fileToBase64 } from "@/utils";
import { v4 as uuid } from "uuid";
import type { Category, Member, ShopMaster } from "@/types";

interface Props { onClose: () => void; onSaved: () => void; }

export default function AddExpenseModal({ onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [shops,      setShops]      = useState<ShopMaster[]>([]);

  const [selCat,    setSelCat]    = useState<string>("");
  const [selMember, setSelMember] = useState<string>("");
  const [selShop,   setSelShop]   = useState<string>("");
  const [amount,    setAmount]    = useState("");
  const [date,      setDate]      = useState(todayString());
  const [memo,      setMemo]      = useState("");
  const [imgData,   setImgData]   = useState<string>("");
  const [newShop,   setNewShop]   = useState("");
  const [showNewShop, setShowNewShop] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [cats, mems, sps] = await Promise.all([
        db.categories.where("isActive").equals(1).sortBy("sortOrder"),
        db.members.where("isActive").equals(1).sortBy("sortOrder"),
        db.shopMasters.where("isActive").equals(1).toArray()
          .then(a => a.filter(s => s.shopType === "general").sort((a,b) => b.usageCount - a.usageCount)),
      ]);
      setCategories(cats.filter(c => !c.isMedical));
      setMembers(mems);
      setShops(sps);
    };
    load();
    setTimeout(() => amountRef.current?.focus(), 300);
  }, []);

  const handleImage = async (file: File) => {
    const b64 = await fileToBase64(file);
    setImgData(b64);
  };

  const addShop = async () => {
    if (!newShop.trim()) return;
    const id = uuid();
    await db.shopMasters.add({ id, name: newShop.trim(), shopType: "general", usageCount: 0, isActive: true, createdAt: new Date() });
    setShops(prev => [{ id, name: newShop.trim(), shopType: "general", usageCount: 0, isActive: true, createdAt: new Date() }, ...prev]);
    setSelShop(id); setNewShop(""); setShowNewShop(false);
  };

  const save = async () => {
    if (!amount || parseInt(amount) <= 0) { alert("金額を入力してください"); return; }
    const shopName = shops.find(s => s.id === selShop)?.name;
    await db.expenses.add({
      id: uuid(), date, amount: parseInt(amount), memo,
      isChecked: false, isFixed: false, productName: "",
      receiptImageData: imgData || undefined,
      memberId:   selMember  || undefined,
      categoryId: selCat     || undefined,
      shopId:     selShop    || undefined,
      shopName,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    if (selShop) await db.shopMasters.where("id").equals(selShop).modify(s => { s.usageCount++; });
    onSaved();
  };

  const canSave = parseInt(amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl flex flex-col"
           style={{ maxHeight: "92vh" }}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400 font-semibold">キャンセル</button>
          <h3 className="text-base font-bold">支出を追加</h3>
          <button onClick={save} disabled={!canSave}
            className="font-bold text-sm"
            style={{color: canSave ? "#3B7DD8" : "#ccc"}}>保存</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* レシート撮影 */}
          <div className="flex gap-3">
            <button onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
              style={{backgroundColor:"#3B7DD8"+"15", color:"#3B7DD8"}}>
              <Camera size={18}/> 撮影
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
              style={{backgroundColor:"#3B7DD8"+"15", color:"#3B7DD8"}}>
              <Image size={18}/> ライブラリ
            </button>
            {imgData && (
              <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
                   style={{backgroundColor:"#3DB87C"+"15", color:"#3DB87C"}}>
                <Icons.CheckCircle2 size={18}/> 添付済み
              </div>
            )}
          </div>
          <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />

          {/* 金額（大きく目立たせる） */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">金額 <span className="text-red-400">※必須</span></label>
            <div className="flex items-center bg-gray-50 rounded-2xl px-4 border-2 border-accent">
              <span className="text-2xl font-bold text-gray-400 mr-2">¥</span>
              <input ref={amountRef} type="number" inputMode="numeric"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 text-4xl font-extrabold bg-transparent outline-none py-3 w-full" />
            </div>
          </div>

          {/* カテゴリ */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">カテゴリ</label>
            <div className="grid grid-cols-4 gap-2">
              {categories.map(cat => {
                const sel = selCat === cat.id;
                const IconComp = (Icons as any)[cat.icon] ?? Icons.MoreHorizontal;
                return (
                  <button key={cat.id} onClick={() => setSelCat(sel ? "" : cat.id)}
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all"
                    style={{
                      backgroundColor: sel ? cat.colorHex+"22" : "#F7F6F2",
                      outline: sel ? `2px solid ${cat.colorHex}` : "none",
                    }}>
                    <IconComp size={20} color={sel ? cat.colorHex : "#9ca3af"} />
                    <span className="text-[10px] font-semibold" style={{color: sel ? cat.colorHex : "#9ca3af"}}>
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 人 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">支払った人</label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m => (
                <button key={m.id} onClick={() => setSelMember(selMember===m.id ? "" : m.id)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={selMember===m.id ? {backgroundColor:"#3B7DD8", color:"#fff"} : {backgroundColor:"#F7F6F2", color:"#374151"}}>
                  {m.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* 店舗 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">店舗</label>
            <div className="flex flex-wrap gap-2">
              {shops.slice(0,12).map(s => (
                <button key={s.id} onClick={() => setSelShop(selShop===s.id ? "" : s.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                  style={selShop===s.id
                    ? {borderColor:"#3B7DD8", color:"#3B7DD8", backgroundColor:"#3B7DD8"+"15"}
                    : {borderColor:"#e5e7eb", color:"#374151", backgroundColor:"#fff"}}>
                  {s.name}
                </button>
              ))}
              <button onClick={() => setShowNewShop(!showNewShop)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                style={{borderColor:"#3B7DD8", color:"#3B7DD8", backgroundColor:"#3B7DD8"+"10"}}>
                ＋追加
              </button>
            </div>
            {showNewShop && (
              <div className="flex gap-2 mt-2">
                <input value={newShop} onChange={e=>setNewShop(e.target.value)}
                  placeholder="店舗名を入力" onKeyDown={e => e.key==="Enter" && addShop()}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none" />
                <button onClick={addShop} className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{backgroundColor:"#3B7DD8"}}>追加</button>
              </div>
            )}
          </div>

          {/* 日付 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">日付</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm outline-none" />
          </div>

          {/* メモ */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">メモ（任意）</label>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)}
              placeholder="備考など" rows={2}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm outline-none resize-none" />
          </div>

          {/* 保存ボタン */}
          <button onClick={save} disabled={!canSave}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all"
            style={{backgroundColor: canSave ? "#3B7DD8" : "#d1d5db"}}>
            保存する
          </button>
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
