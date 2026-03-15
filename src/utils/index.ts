// src/utils/index.ts

export const Colors = {
  accent:       "#3B7DD8",
  medical:      "#E05C5C",
  medicalLight: "#FDEAEA",
  success:      "#3DB87C",
  background:   "#F7F6F2",
  card:         "#FFFFFF",
  border:       "#EEEEEF",
  textPrimary:  "#1A1A2E",
  textSecondary:"#888899",
};

// ── 日付 ──────────────────────────────────────────────────────
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日","月","火","水","木","金","土"];
  return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export function formatMonthYear(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2,"0")}-01`;
  const endY  = month === 12 ? year + 1 : year;
  const endM  = month === 12 ? 1 : month + 1;
  const end   = `${endY}-${String(endM).padStart(2,"0")}-01`;
  return { start, end };
}

export function addMonths(year: number, month: number, delta: number) {
  let m = month - 1 + delta;
  const y = year + Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}

// ── 金額 ──────────────────────────────────────────────────────
export function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

// ── 画像 ──────────────────────────────────────────────────────
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── CSV生成（国税庁医療費集計フォームVer.3.1準拠）──────────────
import type { MedicalExpense } from "@/types";

export function generateMedicalCSV(
  year: number,
  records: MedicalExpense[],
  getMemberName: (id?: string) => string,
  getHospitalName: (id?: string) => string,
): string {
  const headers = [
    "No","医療を受けた人","病院・薬局などの名称",
    "診療・治療","医薬品購入","介護保険サービス","その他の医療費",
    "支払った医療費の金額","左のうち補填される金額","支払年月日",
  ];
  const rows: string[] = [headers.join(",")];

  records.forEach((r, i) => {
    const type = r.isTransportation ? "通院交通費" : r.medicalType;
    rows.push([
      `${i+1}`,
      csvEsc(getMemberName(r.memberId)),
      csvEsc(getHospitalName(r.hospitalId)),
      type === "診療・治療"      ? `${r.amount}` : "",
      type === "医薬品購入"      ? `${r.amount}` : "",
      type === "介護保険サービス" ? `${r.amount}` : "",
      (type === "その他の医療費" || type === "通院交通費") ? `${r.amount}` : "",
      `${r.amount}`,
      `${r.reimbursedAmount}`,
      r.paymentDate,
    ].join(","));
  });

  const total = records.reduce((s,r) => s + r.amount, 0);
  rows.push(["","合計","","","","","",`${total}`,"",""].join(","));

  // UTF-8 BOM付き（Excelで開いたとき文字化けしないおまじない）
  return "\uFEFF" + rows.join("\n");
}

function csvEsc(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g,'""')}"`;
  return s;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// MEDICAL_TYPESをtypesからre-export（AddMedicalModalで使用）
export { MEDICAL_TYPES } from "@/types";
