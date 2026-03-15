// src/db/database.ts
// Dexie.js = IndexedDBをシンプルに使えるライブラリ
// SQLiteと同様に端末内にデータを永続保存する

import Dexie, { type Table } from "dexie";
import { v4 as uuid } from "uuid";
import type {
  Member, Category, ShopMaster, Expense,
  MedicalExpense, FixedExpenseTemplate, FixedExpenseRecord,
} from "@/types";

// ── データベース定義 ──────────────────────────────────────────
class SaifuMemoDB extends Dexie {
  members!:               Table<Member, string>;
  categories!:            Table<Category, string>;
  shopMasters!:           Table<ShopMaster, string>;
  expenses!:              Table<Expense, string>;
  medicalExpenses!:       Table<MedicalExpense, string>;
  fixedTemplates!:        Table<FixedExpenseTemplate, string>;
  fixedRecords!:          Table<FixedExpenseRecord, string>;

  constructor() {
    super("SaifuMemoDB");

    // バージョン1: テーブルとインデックスの定義
    this.version(1).stores({
      members:         "id, sortOrder, isActive",
      categories:      "id, sortOrder, isMedical, isFixed, isActive",
      shopMasters:     "id, shopType, usageCount, isActive",
      expenses:        "id, date, memberId, categoryId, shopId, isChecked, createdAt",
      medicalExpenses: "id, paymentDate, memberId, hospitalId, fiscalYear, isChecked",
      fixedTemplates:  "id, sortOrder, isActive",
      fixedRecords:    "id, [year+month], templateId",
    });
  }
}

export const db = new SaifuMemoDB();

// ── 初期データ投入（初回のみ） ──────────────────────────────
export async function seedIfNeeded(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) return; // すでにデータがあればスキップ

  console.log("📦 初回起動: 初期データを投入します");

  // カテゴリ
  const categories: Category[] = [
    { id: uuid(), name: "食費",     icon: "ShoppingCart", colorHex: "#E8860A", sortOrder: 0,  isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "日用品",   icon: "ShoppingBasket",colorHex: "#9B5CF6", sortOrder: 1,  isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "衣服",     icon: "Shirt",         colorHex: "#E91E8C", sortOrder: 2,  isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "医療費",   icon: "Cross",         colorHex: "#E05C5C", sortOrder: 3,  isMedical: true,  isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "交通費",   icon: "Train",         colorHex: "#0EA5E9", sortOrder: 4,  isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "電気",     icon: "Zap",           colorHex: "#F59E0B", sortOrder: 5,  isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "ガス",     icon: "Flame",         colorHex: "#EF4444", sortOrder: 6,  isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "水道",     icon: "Droplets",      colorHex: "#3B82F6", sortOrder: 7,  isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "家賃",     icon: "Home",          colorHex: "#6366F1", sortOrder: 8,  isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "通信費",   icon: "Wifi",          colorHex: "#8B5CF6", sortOrder: 9,  isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "保険",     icon: "Shield",        colorHex: "#10B981", sortOrder: 10, isMedical: false, isFixed: true,  isCustom: false, isActive: true },
    { id: uuid(), name: "子ども費", icon: "Baby",          colorHex: "#F97316", sortOrder: 11, isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "教育費",   icon: "BookOpen",      colorHex: "#3B82F6", sortOrder: 12, isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "娯楽",     icon: "Gamepad2",      colorHex: "#A855F7", sortOrder: 13, isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "特別費",   icon: "Star",          colorHex: "#EAB308", sortOrder: 14, isMedical: false, isFixed: false, isCustom: false, isActive: true },
    { id: uuid(), name: "その他",   icon: "MoreHorizontal", colorHex: "#6B7280", sortOrder: 15, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  ];
  await db.categories.bulkAdd(categories);

  // 家族メンバー
  await db.members.bulkAdd([
    { id: uuid(), name: "迫田 幸平", shortName: "幸平", sortOrder: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "迫田 玲美", shortName: "玲美", sortOrder: 1, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "迫田 怜來", shortName: "怜來", sortOrder: 2, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "迫田 倖愛", shortName: "倖愛", sortOrder: 3, isActive: true, createdAt: new Date() },
  ]);

  // 店舗マスタ
  await db.shopMasters.bulkAdd([
    { id: uuid(), name: "イオン流山おおたかの森",         shopType: "general",  usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "マツモトキヨシ",                shopType: "general",  usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "ウエルシア",                   shopType: "general",  usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "業務スーパー",                  shopType: "general",  usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "そうごう薬局",                  shopType: "pharmacy", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "アイセイ薬局",                  shopType: "pharmacy", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "電車・バス・タクシー",           shopType: "general",  usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "おおたかの森こどもクリニック",    shopType: "hospital", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "レラデンタルクリニック",          shopType: "hospital", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "こばやし耳鼻科",                shopType: "hospital", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "みわ歯科",                     shopType: "hospital", usageCount: 0, isActive: true, createdAt: new Date() },
    { id: uuid(), name: "キャップスクリニック流山おおたかの森", shopType: "hospital", usageCount: 0, isActive: true, createdAt: new Date() },
  ]);

  // 固定費テンプレート
  await db.fixedTemplates.bulkAdd([
    { id: uuid(), name: "電気代",  defaultAmount: 8000,  dayOfMonth: 1, isActive: true, sortOrder: 0 },
    { id: uuid(), name: "ガス代",  defaultAmount: 5000,  dayOfMonth: 1, isActive: true, sortOrder: 1 },
    { id: uuid(), name: "水道代",  defaultAmount: 3000,  dayOfMonth: 1, isActive: true, sortOrder: 2 },
    { id: uuid(), name: "家賃",    defaultAmount: 90000, dayOfMonth: 1, isActive: true, sortOrder: 3 },
    { id: uuid(), name: "通信費",  defaultAmount: 8000,  dayOfMonth: 1, isActive: true, sortOrder: 4 },
  ]);

  // 今月の固定費レコードを生成
  await generateFixedRecords();

  console.log("✅ 初期データ投入完了");
}

// 固定費の毎月自動生成
export async function generateFixedRecords(): Promise<void> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const templates = await db.fixedTemplates.where("isActive").equals(1).toArray();
  for (const t of templates) {
    const exists = await db.fixedRecords
      .where(["year+month"])
      .equals([year, month])
      .filter(r => r.templateId === t.id)
      .count();
    if (exists === 0) {
      await db.fixedRecords.add({
        id: uuid(), year, month,
        actualAmount: t.defaultAmount,
        isConfirmed: false,
        templateId: t.id,
      });
    }
  }
}
