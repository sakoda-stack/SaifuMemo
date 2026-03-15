import type { MedicalExpense } from "@/types";

export const Colors = {
  accent: "#3b7dd8",
  medical: "#d05c54",
  medicalLight: "#fdeaea",
  success: "#4d8762",
  background: "#f3ede4",
  card: "#fffdf7",
  border: "#d8cebf",
  textPrimary: "#372f28",
  textSecondary: "#7c7064",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function todayString(baseDate = new Date()): string {
  return toDateString(baseDate);
}

export function toDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function isDateString(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function normalizeDateInput(value: string | undefined, fallback = todayString()): string {
  return isDateString(value) ? value : fallback;
}

export function formatDateDisplay(dateStr: string): string {
  const date = parseDateString(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日 (${WEEKDAYS[date.getDay()]})`;
}

export function formatMonthYear(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function formatRelativeMonthLabel(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export function getMonthDays(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

export function addMonths(year: number, month: number, delta: number) {
  const base = new Date(year, month - 1 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
}

export function compactYen(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${Math.round((value / 10000) * 10) / 10}万円`;
  }

  return `¥${value.toLocaleString("ja-JP")}`;
}

export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function sumBy<T>(rows: T[], getter: (row: T) => number): number {
  return rows.reduce((total, row) => total + getter(row), 0);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function generateMedicalCSV(
  _year: number,
  records: MedicalExpense[],
  getMemberName: (id?: string) => string,
  getHospitalName: (id?: string) => string,
): string {
  const headers = [
    "No",
    "医療を受けた人",
    "病院・薬局などの名称",
    "診療・治療",
    "医薬品購入",
    "介護保険サービス",
    "その他の医療費",
    "支払った医療費の金額",
    "左のうち補填される金額",
    "支払年月日",
  ];
  const rows = [headers.join(",")];

  records.forEach((record, index) => {
    const type = record.isTransportation ? "通院交通費" : record.medicalType;
    rows.push(
      [
        `${index + 1}`,
        csvEsc(getMemberName(record.memberId)),
        csvEsc(getHospitalName(record.hospitalId)),
        type === "診療・治療" ? `${record.amount}` : "",
        type === "医薬品購入" ? `${record.amount}` : "",
        type === "介護保険サービス" ? `${record.amount}` : "",
        type === "その他の医療費" || type === "通院交通費" ? `${record.amount}` : "",
        `${record.amount}`,
        `${record.reimbursedAmount}`,
        record.paymentDate,
      ].join(","),
    );
  });

  rows.push(["", "合計", "", "", "", "", "", `${sumBy(records, (record) => record.amount)}`, "", ""].join(","));
  return "\uFEFF" + rows.join("\n");
}

function csvEsc(value: string): string {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export { MEDICAL_TYPES } from "@/types";
