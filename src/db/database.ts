// src/db/database.ts
// Dexie.js = IndexedDBをシンプルに使えるライブラリ
// SQLiteと同様に端末内にデータを永続保存する

import Dexie, { type Table } from "dexie";
import { v4 as uuid } from "uuid";
import type {
  Member,
  Category,
  ShopMaster,
  Expense,
  MedicalExpense,
  FixedExpenseTemplate,
  FixedExpenseRecord,
  ReceiptItemObservation,
} from "@/types";

class SaifuMemoDB extends Dexie {
  members!: Table<Member, string>;
  categories!: Table<Category, string>;
  shopMasters!: Table<ShopMaster, string>;
  expenses!: Table<Expense, string>;
  medicalExpenses!: Table<MedicalExpense, string>;
  fixedTemplates!: Table<FixedExpenseTemplate, string>;
  fixedRecords!: Table<FixedExpenseRecord, string>;
  receiptItemObservations!: Table<ReceiptItemObservation, string>;

  constructor() {
    super("SaifuMemoDB");

    this.version(1).stores({
      members: "id, sortOrder, isActive",
      categories: "id, sortOrder, isMedical, isFixed, isActive",
      shopMasters: "id, shopType, usageCount, isActive",
      expenses: "id, date, memberId, categoryId, shopId, isChecked, createdAt",
      medicalExpenses: "id, paymentDate, memberId, hospitalId, fiscalYear, isChecked",
      fixedTemplates: "id, sortOrder, isActive",
      fixedRecords: "id, [year+month], templateId",
    });

    this.version(2).stores({
      members: "id, sortOrder, isActive",
      categories: "id, sortOrder, isMedical, isFixed, isActive",
      shopMasters: "id, shopType, usageCount, isActive",
      expenses: "id, date, memberId, categoryId, shopId, isChecked, createdAt",
      medicalExpenses: "id, paymentDate, memberId, hospitalId, fiscalYear, isChecked",
      fixedTemplates: "id, sortOrder, isActive",
      fixedRecords: "id, [year+month], templateId",
      receiptItemObservations: "id, expenseId, expenseDate, normalizedItemName, shopName, unitPrice, totalPrice, createdAt",
    });
  }
}

export const db = new SaifuMemoDB();

type MemberSeed = Omit<Member, "id" | "createdAt">;
type CategorySeed = Omit<Category, "id">;
type ShopSeed = Omit<ShopMaster, "id" | "createdAt">;
type FixedTemplateSeed = Omit<FixedExpenseTemplate, "id">;

const DEFAULT_CATEGORIES: CategorySeed[] = [
  { name: "食費", icon: "ShoppingCart", colorHex: "#D68C45", sortOrder: 0, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "日用品", icon: "ShoppingBasket", colorHex: "#C97B63", sortOrder: 1, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "衣服", icon: "Shirt", colorHex: "#B8739A", sortOrder: 2, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "医療費", icon: "HeartPulse", colorHex: "#D46A6A", sortOrder: 3, isMedical: true, isFixed: false, isCustom: false, isActive: true },
  { name: "交通費", icon: "Train", colorHex: "#6A84C3", sortOrder: 4, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "電気", icon: "Zap", colorHex: "#D5A740", sortOrder: 5, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "ガス", icon: "Flame", colorHex: "#D46A6A", sortOrder: 6, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "水道", icon: "Droplets", colorHex: "#5D948A", sortOrder: 7, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "家賃", icon: "Home", colorHex: "#8A73BE", sortOrder: 8, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "通信費", icon: "Wifi", colorHex: "#6A84C3", sortOrder: 9, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "保険", icon: "Shield", colorHex: "#7E9C68", sortOrder: 10, isMedical: false, isFixed: true, isCustom: false, isActive: true },
  { name: "子ども費", icon: "Baby", colorHex: "#D68C45", sortOrder: 11, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "教育費", icon: "BookOpen", colorHex: "#6A84C3", sortOrder: 12, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "娯楽", icon: "Gamepad2", colorHex: "#8A73BE", sortOrder: 13, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "特別費", icon: "Star", colorHex: "#D5A740", sortOrder: 14, isMedical: false, isFixed: false, isCustom: false, isActive: true },
  { name: "その他", icon: "MoreHorizontal", colorHex: "#7A7A7A", sortOrder: 15, isMedical: false, isFixed: false, isCustom: false, isActive: true },
];

const DEFAULT_MEMBERS: MemberSeed[] = [
  { name: "迫田 幸平", shortName: "幸平", sortOrder: 0, isActive: true },
  { name: "迫田 玲美", shortName: "玲美", sortOrder: 1, isActive: true },
  { name: "迫田 怜來", shortName: "怜來", sortOrder: 2, isActive: true },
  { name: "迫田 倖愛", shortName: "倖愛", sortOrder: 3, isActive: true },
];

const DEFAULT_SHOPS: ShopSeed[] = [
  { name: "イオン流山おおたかの森", shopType: "general", usageCount: 0, isActive: true },
  { name: "マツモトキヨシ", shopType: "general", usageCount: 0, isActive: true },
  { name: "ウエルシア", shopType: "general", usageCount: 0, isActive: true },
  { name: "業務スーパー", shopType: "general", usageCount: 0, isActive: true },
  { name: "西松屋", shopType: "general", usageCount: 0, isActive: true },
  { name: "電車・バス", shopType: "general", usageCount: 0, isActive: true },
  { name: "そうごう薬局", shopType: "pharmacy", usageCount: 0, isActive: true },
  { name: "アイセイ薬局", shopType: "pharmacy", usageCount: 0, isActive: true },
  { name: "おおたかの森こどもクリニック", shopType: "hospital", usageCount: 0, isActive: true },
  { name: "レラデンタルクリニック", shopType: "hospital", usageCount: 0, isActive: true },
  { name: "こばやし耳鼻科", shopType: "hospital", usageCount: 0, isActive: true },
  { name: "みわ歯科", shopType: "hospital", usageCount: 0, isActive: true },
];

const DEFAULT_FIXED_TEMPLATES: FixedTemplateSeed[] = [
  { name: "電気代", defaultAmount: 8000, dayOfMonth: 1, isActive: true, sortOrder: 0 },
  { name: "ガス代", defaultAmount: 5000, dayOfMonth: 1, isActive: true, sortOrder: 1 },
  { name: "水道代", defaultAmount: 3000, dayOfMonth: 1, isActive: true, sortOrder: 2 },
  { name: "家賃", defaultAmount: 90000, dayOfMonth: 1, isActive: true, sortOrder: 3 },
  { name: "通信費", defaultAmount: 8000, dayOfMonth: 1, isActive: true, sortOrder: 4 },
];

export async function seedIfNeeded(): Promise<void> {
  await db.transaction(
    "rw",
    db.categories,
    db.members,
    db.shopMasters,
    db.fixedTemplates,
    async () => {
      if (await db.categories.count() === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((category) => ({ id: uuid(), ...category })));
      }

      if (await db.members.count() === 0) {
        await db.members.bulkAdd(
          DEFAULT_MEMBERS.map((member) => ({
            id: uuid(),
            createdAt: new Date(),
            ...member,
          })),
        );
      }

      if (await db.shopMasters.count() === 0) {
        await db.shopMasters.bulkAdd(
          DEFAULT_SHOPS.map((shop) => ({
            id: uuid(),
            createdAt: new Date(),
            ...shop,
          })),
        );
      }

      if (await db.fixedTemplates.count() === 0) {
        await db.fixedTemplates.bulkAdd(
          DEFAULT_FIXED_TEMPLATES.map((template) => ({
            id: uuid(),
            ...template,
          })),
        );
      }
    },
  );

  await normalizeCategoryDefaults();
  await generateFixedRecords();
}

async function normalizeCategoryDefaults(): Promise<void> {
  const categories = await db.categories.toArray();
  const defaultByName = new Map(DEFAULT_CATEGORIES.map((category) => [category.name, category]));

  await Promise.all(
    categories.map(async (category) => {
      const defaults = defaultByName.get(category.name);
      if (!defaults || category.isCustom) {
        return;
      }

      const updates: Partial<Category> = {};

      if (!category.icon || category.icon === "Cross") {
        updates.icon = defaults.icon;
      }
      if (!category.colorHex) {
        updates.colorHex = defaults.colorHex;
      }

      if (Object.keys(updates).length > 0) {
        await db.categories.update(category.id, updates);
      }
    }),
  );
}

export async function generateFixedRecords(): Promise<void> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const templates = (await db.fixedTemplates.orderBy("sortOrder").toArray()).filter((template) => template.isActive);

  for (const template of templates) {
    const exists = await db.fixedRecords
      .where("[year+month]")
      .equals([year, month])
      .filter((record) => record.templateId === template.id)
      .count();

    if (exists === 0) {
      await db.fixedRecords.add({
        id: uuid(),
        year,
        month,
        actualAmount: template.defaultAmount,
        isConfirmed: false,
        templateId: template.id,
      });
    }
  }
}

export async function getMonthlyFixedRecords(year: number, month: number) {
  const [templates, records] = await Promise.all([
    db.fixedTemplates.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
    db.fixedRecords.where("[year+month]").equals([year, month]).toArray(),
  ]);
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  return records
    .map((record) => {
      const template = record.templateId ? templateMap.get(record.templateId) : undefined;
      if (!template) {
        return null;
      }

      return {
        ...record,
        templateName: template.name,
      };
    })
    .filter((record): record is FixedExpenseRecord & { templateName: string } => record !== null)
    .sort((left, right) => left.templateName.localeCompare(right.templateName, "ja"));
}

export async function replaceReceiptItemObservations(
  expenseId: string,
  observations: Omit<ReceiptItemObservation, "id" | "createdAt" | "expenseId">[],
): Promise<void> {
  await db.transaction("rw", db.receiptItemObservations, async () => {
    await db.receiptItemObservations.where("expenseId").equals(expenseId).delete();

    if (observations.length === 0) {
      return;
    }

    await db.receiptItemObservations.bulkAdd(
      observations.map((observation) => ({
        id: uuid(),
        expenseId,
        createdAt: new Date(),
        ...observation,
      })),
    );
  });
}

export async function deleteExpenseCascade(expenseId: string) {
  await db.transaction("rw", db.expenses, db.receiptItemObservations, async () => {
    await db.receiptItemObservations.where("expenseId").equals(expenseId).delete();
    await db.expenses.delete(expenseId);
  });
}
