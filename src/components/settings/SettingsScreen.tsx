// src/components/settings/SettingsScreen.tsx

import { useState, useEffect } from "react";
import { ChevronRight, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import * as Icons from "lucide-react";
import { db } from "@/db/database";
import { formatYen } from "@/utils";
import type { Member, ShopMaster, Category, FixedExpenseTemplate, FixedExpenseRecord } from "@/types";
import { v4 as uuid } from "uuid";

type Section = "menu"|"members"|"hospitals"|"shops"|"categories"|"fixed-tmpl"|"fixed-month"|"checklist";

export default function SettingsScreen() {
  const [section, setSection] = useState<Section>("menu");
  const today = new Date();

  if (section==="members")   return <MembersSection    onBack={()=>setSection("menu")}/>;
  if (section==="hospitals") return <ShopsSection      onBack={()=>setSection("menu")} type="hospital" title="病院・薬局マスタ"/>;
  if (section==="shops")     return <ShopsSection      onBack={()=>setSection("menu")} type="general"  title="店舗マスタ"/>;
  if (section==="categories")return <CategoriesSection onBack={()=>setSection("menu")}/>;
  if (section==="fixed-tmpl")return <FixedTemplSection onBack={()=>setSection("menu")}/>;
  if (section==="fixed-month")return<FixedMonthSection onBack={()=>setSection("menu")} year={today.getFullYear()} month={today.getMonth()+1}/>;
  if (section==="checklist") return <ChecklistSection  onBack={()=>setSection("menu")}/>;

  return (
    <div className="p-4 pb-6 slide-up">
      <h2 className="text-2xl font-extrabold pt-2 mb-5">設定</h2>
      <SettingGroup title="マスタ管理">
        <SettingRow icon="👨‍👩‍👧‍👦" label="家族メンバー"   onTap={()=>setSection("members")}/>
        <SettingRow icon="🏥" label="病院・薬局マスタ" onTap={()=>setSection("hospitals")}/>
        <SettingRow icon="🏪" label="店舗マスタ"       onTap={()=>setSection("shops")}/>
        <SettingRow icon="🏷️" label="カテゴリ管理"     onTap={()=>setSection("categories")}/>
      </SettingGroup>
      <SettingGroup title="固定費">
        <SettingRow icon="🔁" label="固定費テンプレート" onTap={()=>setSection("fixed-tmpl")}/>
        <SettingRow icon="📅" label="今月の固定費を確認" onTap={()=>setSection("fixed-month")}/>
      </SettingGroup>
      <SettingGroup title="確定申告">
        <SettingRow icon="✅" label="申告チェックリスト" onTap={()=>setSection("checklist")}/>
      </SettingGroup>
      <div className="text-center text-xs text-gray-400 mt-6">さいふメモ v1.0</div>
    </div>
  );
}

function SettingGroup({title,children}:{title:string;children:React.ReactNode}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-gray-400 mb-2 ml-1">{title}</p>
      <div className="bg-white rounded-2xl overflow-hidden">{children}</div>
    </div>
  );
}
function SettingRow({icon,label,onTap}:{icon:string;label:string;onTap:()=>void}) {
  return (
    <button onClick={onTap} className="w-full flex items-center gap-3 px-4 py-4 border-b last:border-b-0 border-gray-50 active:bg-gray-50">
      <span className="text-xl w-7">{icon}</span>
      <span className="flex-1 text-left text-sm font-semibold">{label}</span>
      <ChevronRight size={16} color="#ccc"/>
    </button>
  );
}

// ── メンバー管理 ──────────────────────────────────────────────
function MembersSection({onBack}:{onBack:()=>void}) {
  const [members,setMembers]=useState<Member[]>([]);
  const [name,setName]=useState(""); const [short,setShort]=useState(""); const [show,setShow]=useState(false);
  const load=()=>db.members.where("isActive").equals(1).sortBy("sortOrder").then(setMembers);
  useEffect(()=>{load();},[]);
  const add=async()=>{
    if(!name.trim())return;
    await db.members.add({id:uuid(),name:name.trim(),shortName:short.trim()||name.trim(),sortOrder:members.length,isActive:true,createdAt:new Date()});
    setName("");setShort("");setShow(false);load();
  };
  const del=async(id:string,n:string)=>{
    if(confirm(`${n}を削除しますか？`)){await db.members.update(id,{isActive:false});load();}
  };
  return <ListLayout title="家族メンバー" onBack={onBack} onAdd={()=>setShow(true)}>
    {show&&<AddForm fields={[{ph:"フルネーム（例: 迫田 玲美）",val:name,set:setName},{ph:"短い名前（例: 玲美）",val:short,set:setShort}]} onSave={add} onCancel={()=>setShow(false)}/>}
    {members.map(m=>(
      <ItemRow key={m.id} main={m.name} sub={`表示名: ${m.shortName}`} onDel={()=>del(m.id,m.name)}/>
    ))}
  </ListLayout>;
}

// ── 店舗・病院管理 ────────────────────────────────────────────
function ShopsSection({onBack,type,title}:{onBack:()=>void;type:"hospital"|"pharmacy"|"general";title:string}) {
  const [shops,setShops]=useState<ShopMaster[]>([]);
  const [name,setName]=useState(""); const [show,setShow]=useState(false);
  const load=()=>db.shopMasters.where("isActive").equals(1).toArray()
    .then(a=>setShops(a.filter(s=>type==="hospital"?(s.shopType==="hospital"||s.shopType==="pharmacy"):s.shopType===type).sort((a,b)=>b.usageCount-a.usageCount)));
  useEffect(()=>{load();},[]);
  const add=async()=>{
    if(!name.trim())return;
    await db.shopMasters.add({id:uuid(),name:name.trim(),shopType:type==="general"?"general":"hospital",usageCount:0,isActive:true,createdAt:new Date()});
    setName("");setShow(false);load();
  };
  const del=async(id:string,n:string)=>{if(confirm(`${n}を削除しますか？`)){await db.shopMasters.update(id,{isActive:false});load();}};
  return <ListLayout title={title} onBack={onBack} onAdd={()=>setShow(true)}>
    {show&&<AddForm fields={[{ph:"名称を入力",val:name,set:setName}]} onSave={add} onCancel={()=>setShow(false)}/>}
    {shops.map(s=><ItemRow key={s.id} main={s.name} sub={`使用${s.usageCount}回`} onDel={()=>del(s.id,s.name)}/>)}
  </ListLayout>;
}

// ── カテゴリ管理 ──────────────────────────────────────────────
function CategoriesSection({onBack}:{onBack:()=>void}) {
  const [cats,setCats]=useState<Category[]>([]);
  const [name,setName]=useState(""); const [show,setShow]=useState(false);
  const load=()=>db.categories.where("isActive").equals(1).sortBy("sortOrder").then(setCats);
  useEffect(()=>{load();},[]);
  const add=async()=>{
    if(!name.trim())return;
    await db.categories.add({id:uuid(),name:name.trim(),icon:"MoreHorizontal",colorHex:"#6B7280",sortOrder:cats.length,isMedical:false,isFixed:false,isCustom:true,isActive:true});
    setName("");setShow(false);load();
  };
  const del=async(c:Category)=>{
    if(!c.isCustom){alert("デフォルトカテゴリは削除できません");return;}
    if(confirm(`${c.name}を削除しますか？`)){await db.categories.update(c.id,{isActive:false});load();}
  };
  return <ListLayout title="カテゴリ管理" onBack={onBack} onAdd={()=>setShow(true)}>
    {show&&<AddForm fields={[{ph:"カテゴリ名（例: ペット費）",val:name,set:setName}]} onSave={add} onCancel={()=>setShow(false)}/>}
    {cats.map(c=>{
      const IconComp=(Icons as any)[c.icon]??Icons.MoreHorizontal;
      return <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor:c.colorHex+"22"}}>
          <IconComp size={16} color={c.colorHex}/>
        </div>
        <span className="flex-1 text-sm font-semibold">{c.name}</span>
        {c.isCustom&&<span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-semibold">カスタム</span>}
        <button onClick={()=>del(c)} className="p-2"><Trash2 size={14} color={c.isCustom?"#E05C5C":"#ccc"}/></button>
      </div>;
    })}
  </ListLayout>;
}

// ── 固定費テンプレート ────────────────────────────────────────
function FixedTemplSection({onBack}:{onBack:()=>void}) {
  const [tmpls,setTmpls]=useState<FixedExpenseTemplate[]>([]);
  const [name,setName]=useState(""); const [amt,setAmt]=useState(""); const [show,setShow]=useState(false);
  const load=()=>db.fixedTemplates.where("isActive").equals(1).sortBy("sortOrder").then(setTmpls);
  useEffect(()=>{load();},[]);
  const add=async()=>{
    if(!name.trim()||!amt)return;
    await db.fixedTemplates.add({id:uuid(),name:name.trim(),defaultAmount:parseInt(amt),dayOfMonth:1,isActive:true,sortOrder:tmpls.length});
    setName("");setAmt("");setShow(false);load();
  };
  const del=async(id:string,n:string)=>{if(confirm(`${n}を削除しますか？`)){await db.fixedTemplates.update(id,{isActive:false});load();}};
  return <ListLayout title="固定費テンプレート" onBack={onBack} onAdd={()=>setShow(true)}>
    <p className="px-4 py-2 text-xs text-gray-400">毎月1日に自動でレコードが作成されます</p>
    {show&&<div className="px-4 pb-3 space-y-2 bg-gray-50">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="名称（例: 電気代）" className="w-full px-3 py-2 rounded-xl border text-sm outline-none"/>
      <div className="flex gap-2">
        <span className="self-center text-gray-400">¥</span>
        <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="標準金額" className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none"/>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setShow(false)} className="flex-1 py-2 rounded-xl bg-gray-200 text-sm font-semibold">キャンセル</button>
        <button onClick={add} className="flex-1 py-2 rounded-xl text-white text-sm font-bold" style={{backgroundColor:"#3DB87C"}}>追加</button>
      </div>
    </div>}
    {tmpls.map(t=><ItemRow key={t.id} main={t.name} sub={`標準: ${formatYen(t.defaultAmount)}`} onDel={()=>del(t.id,t.name)}/>)}
  </ListLayout>;
}

// ── 今月の固定費 ──────────────────────────────────────────────
function FixedMonthSection({onBack,year,month}:{onBack:()=>void;year:number;month:number}) {
  const [records,setRecords]=useState<(FixedExpenseRecord&{templateName?:string;defaultAmount?:number})[]>([]);
  useEffect(()=>{
    const load=async()=>{
      const recs=await db.fixedRecords.where("[year+month]").equals([year,month]).toArray();
      const tmpls=await db.fixedTemplates.toArray();
      const tmap=new Map(tmpls.map(t=>[t.id,t]));
      setRecords(recs.map(r=>({...r,templateName:tmap.get(r.templateId??"")?.name,defaultAmount:tmap.get(r.templateId??"")?.defaultAmount})));
    };
    load();
  },[year,month]);
  const updateAmt=async(id:string,val:string)=>{
    const n=parseInt(val);
    if(!isNaN(n))await db.fixedRecords.update(id,{actualAmount:n});
  };
  const toggleConfirm=async(id:string,cur:boolean)=>{
    await db.fixedRecords.update(id,{isConfirmed:!cur});
    setRecords(prev=>prev.map(r=>r.id===id?{...r,isConfirmed:!cur}:r));
  };
  return <ListLayout title={`${year}年${month}月の固定費`} onBack={onBack}>
    {records.map(r=>(
      <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
        <div className="flex-1">
          <p className="text-sm font-semibold">{r.templateName}</p>
          {r.defaultAmount&&r.actualAmount!==r.defaultAmount&&<p className="text-xs text-blue-400">標準: {formatYen(r.defaultAmount)}</p>}
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200">
          <span className="text-gray-400 text-sm">¥</span>
          <input type="number" defaultValue={r.actualAmount} onBlur={e=>updateAmt(r.id,e.target.value)}
            className="w-20 text-base font-bold text-right bg-transparent outline-none"/>
        </div>
        <button onClick={()=>toggleConfirm(r.id,r.isConfirmed)}>
          {r.isConfirmed?<CheckCircle2 size={26} color="#3DB87C"/>:<Circle size={26} color="#ccc"/>}
        </button>
      </div>
    ))}
  </ListLayout>;
}

// ── 確定申告チェックリスト ───────────────────────────────────
const CHECKLIST=[
  {id:"1",title:"医療費明細を全て入力した",sub:"「医療費」タブで全員分を確認"},
  {id:"2",title:"領収書と金額が一致しているか確認した",sub:"「明細」タブの確認チェック機能を使用"},
  {id:"3",title:"補填された金額を差し引いた",sub:"保険金・高額療養費がある場合"},
  {id:"4",title:"通院交通費を含めた",sub:"公共交通機関のみ対象（タクシーは原則不可）"},
  {id:"5",title:"家族全員分が揃っているか確認した",sub:"「医療費」タブで人別フィルタを使って確認"},
  {id:"6",title:"CSVをe-Taxまたはマイナポータルにインポートした",sub:"「医療費」タブ → CSV出力"},
];
function ChecklistSection({onBack}:{onBack:()=>void}) {
  const [checks,setChecks]=useState<Record<string,boolean>>({});
  const done=Object.values(checks).filter(Boolean).length;
  return <ListLayout title="申告チェックリスト" onBack={onBack}>
    <div className="px-4 py-3">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div className="h-full rounded-full transition-all" style={{width:`${done/CHECKLIST.length*100}%`,backgroundColor:done===CHECKLIST.length?"#3DB87C":"#3B7DD8"}}/>
      </div>
      <p className="text-xs text-gray-400 text-right">{done}/{CHECKLIST.length} 完了</p>
    </div>
    {CHECKLIST.map(item=>(
      <button key={item.id} onClick={()=>setChecks(p=>({...p,[item.id]:!p[item.id]}))}
        className="w-full flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 active:bg-gray-50">
        {checks[item.id]?<CheckCircle2 size={22} color="#3DB87C" className="mt-0.5 shrink-0"/>:<Circle size={22} color="#ccc" className="mt-0.5 shrink-0"/>}
        <div className="text-left">
          <p className={`text-sm font-semibold ${checks[item.id]?"line-through text-gray-400":""}`}>{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
        </div>
      </button>
    ))}
  </ListLayout>;
}

// ── 共通レイアウト部品 ────────────────────────────────────────
function ListLayout({title,onBack,onAdd,children}:{title:string;onBack:()=>void;onAdd?:()=>void;children:React.ReactNode}) {
  return (
    <div className="flex flex-col h-full slide-up">
      <div className="flex items-center justify-between px-4 py-3 bg-app-bg border-b border-gray-100">
        <button onClick={onBack} className="text-blue-500 font-semibold text-sm">← 戻る</button>
        <h3 className="text-base font-bold">{title}</h3>
        {onAdd?<button onClick={onAdd} className="p-2"><Plus size={20} color="#3B7DD8"/></button>:<div className="w-10"/>}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function ItemRow({main,sub,onDel}:{main:string;sub:string;onDel:()=>void}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 bg-white">
      <div className="flex-1">
        <p className="text-sm font-semibold">{main}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <button onClick={onDel} className="p-2"><Trash2 size={14} color="#E05C5C"/></button>
    </div>
  );
}

function AddForm({fields,onSave,onCancel}:{fields:{ph:string;val:string;set:(v:string)=>void}[];onSave:()=>void;onCancel:()=>void}) {
  return (
    <div className="px-4 py-3 bg-gray-50 space-y-2 border-b border-gray-100">
      {fields.map((f,i)=>(
        <input key={i} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} autoFocus={i===0}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white"/>
      ))}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl bg-gray-200 text-sm font-semibold">キャンセル</button>
        <button onClick={onSave}   className="flex-1 py-2 rounded-xl text-white text-sm font-bold" style={{backgroundColor:"#3B7DD8"}}>追加</button>
      </div>
    </div>
  );
}
