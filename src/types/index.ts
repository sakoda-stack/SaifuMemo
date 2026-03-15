// src/types/index.ts

export interface Member {
  id: string;
  name: string;
  shortName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  icon: string;       // lucide-reactのアイコン名
  colorHex: string;
  sortOrder: number;
  isMedical: boolean;
  isFixed: boolean;
  isCustom: boolean;
  isActive: boolean;
}

export interface ShopMaster {
  id: string;
  name: string;
  shopType: "general" | "hospital" | "pharmacy";
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Expense {
  id: string;
  date: string;           // YYYY-MM-DD
  amount: number;
  memo: string;
  isChecked: boolean;
  isFixed: boolean;
  productName: string;
  receiptImageData?: string; // Base64画像データ
  memberId?: string;
  categoryId?: string;
  shopId?: string;
  shopName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptItemObservation {
  id: string;
  expenseId: string;
  expenseDate: string;
  itemName: string;
  normalizedItemName: string;
  shopId?: string;
  shopName?: string;
  totalPrice: number;
  quantity?: number;
  quantityUnit?: string;
  unitPrice?: number;
  sourceText: string;
  createdAt: Date;
}

export interface MedicalExpense {
  id: string;
  paymentDate: string;    // YYYY-MM-DD
  amount: number;
  reimbursedAmount: number;
  medicalType: MedicalType;
  isTransportation: boolean;
  isChecked: boolean;
  fiscalYear: number;
  receiptImageData?: string;
  memberId?: string;
  hospitalId?: string;
  hospitalName?: string;
  createdAt: Date;
}

export type MedicalType =
  | "診療・治療"
  | "医薬品購入"
  | "介護保険サービス"
  | "その他の医療費"
  | "通院交通費";

export const MEDICAL_TYPES: Exclude<MedicalType, "通院交通費">[] = [
  "診療・治療",
  "医薬品購入",
  "介護保険サービス",
  "その他の医療費",
];

export interface FixedExpenseTemplate {
  id: string;
  name: string;
  defaultAmount: number;
  dayOfMonth: number;
  isActive: boolean;
  sortOrder: number;
  categoryId?: string;
}

export interface FixedExpenseRecord {
  id: string;
  year: number;
  month: number;
  actualAmount: number;
  isConfirmed: boolean;
  templateId?: string;
}

// 集計用
export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
}
