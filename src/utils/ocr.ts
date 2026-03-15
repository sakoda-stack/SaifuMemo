import type { MedicalType } from "@/types";

export interface ExpenseOcrDraft {
  amount?: number;
  date?: string;
  items: OcrReceiptItem[];
  shopName?: string;
  memo?: string;
}

export interface MedicalOcrDraft {
  amount?: number;
  date?: string;
  hospitalName?: string;
  medicalType?: MedicalType;
}

export interface OcrScanResult<TDraft> {
  confidence: number;
  draft: TDraft;
  text: string;
}

export interface OcrReceiptItem {
  itemName: string;
  normalizedItemName: string;
  quantity?: number;
  quantityUnit?: string;
  totalPrice: number;
  unitPrice?: number;
  sourceText: string;
}

const TOTAL_LABEL_PATTERN = /(合計|総計|現計|小計|お預り|お釣り|税込|税抜|クレジット|電子マネー|ポイント|値引|割引|TEL|電話)/i;
const RECEIPT_SKIP_PATTERN = /(領収|レシート|ありがとうございました|承認|取引|伝票|No\.?|番号|内訳|担当|担当者)/i;
const DATE_LINE_PATTERN =
  /(20\d{2}|\d{2})[\/.\-年]\s*\d{1,2}[\/.\-月]\s*\d{1,2}(?:日)?|\d{1,2}:\d{2}/;
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s?(kg|g|ml|mL|l|L|個|本|枚|袋|パック|P|p|缶|玉|箱)/;

export async function recognizeExpenseReceipt(imageData: string): Promise<OcrScanResult<ExpenseOcrDraft>> {
  const { text, confidence } = await runOcr(imageData);
  return {
    confidence,
    text,
    draft: parseExpenseOcrText(text),
  };
}

export async function recognizeMedicalReceipt(imageData: string): Promise<OcrScanResult<MedicalOcrDraft>> {
  const { text, confidence } = await runOcr(imageData);
  return {
    confidence,
    text,
    draft: parseMedicalOcrText(text),
  };
}

export function parseExpenseOcrText(text: string): ExpenseOcrDraft {
  const cleaned = normalizeOcrText(text);
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const amount = extractAmount(lines);
  const date = extractDate(cleaned);
  const shopName = extractMerchantName(lines);

  return {
    amount,
    date,
    items: extractReceiptItems(lines),
    shopName,
    memo: shopName ? `${shopName}のレシートをOCRで読み取り` : undefined,
  };
}

export function parseMedicalOcrText(text: string): MedicalOcrDraft {
  const cleaned = normalizeOcrText(text);
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const amount = extractAmount(lines);
  const date = extractDate(cleaned);
  const hospitalName = extractMedicalFacility(lines);

  return {
    amount,
    date,
    hospitalName,
    medicalType: inferMedicalType(cleaned),
  };
}

export function toObservationPayload(
  draft: ExpenseOcrDraft,
  expenseDate: string,
  shopName?: string,
  shopId?: string,
) {
  return draft.items.map((item) => ({
    expenseDate,
    itemName: item.itemName,
    normalizedItemName: item.normalizedItemName,
    shopId,
    shopName,
    totalPrice: item.totalPrice,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    unitPrice: item.unitPrice,
    sourceText: item.sourceText,
  }));
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

async function runOcr(imageData: string) {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(imageData, "jpn+eng", {
    logger: () => undefined,
  });

  return {
    text: normalizeOcrText(result.data.text),
    confidence: result.data.confidence ?? 0,
  };
}

function normalizeOcrText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function extractAmount(lines: string[]) {
  const labeled = lines
    .flatMap((line) => {
      const normalized = line.replace(/[¥,]/g, "");
      return Array.from(normalized.matchAll(/(?:合計|総計|現計|税込|お預り|お会計)\s*([0-9]{2,7})/g)).map((match) => ({
        amount: parseInt(match[1], 10),
        priority: /(合計|総計|現計|お会計)/.test(line) ? 100 : 20,
      }));
    })
    .filter((candidate) => Number.isFinite(candidate.amount) && candidate.amount > 0);

  if (labeled.length > 0) {
    return labeled.sort((left, right) => right.priority - left.priority || right.amount - left.amount)[0].amount;
  }

  const fallback = lines
    .flatMap((line) => Array.from(line.replace(/[¥,]/g, "").matchAll(/([0-9]{2,7})/g)))
    .map((match) => parseInt(match[1], 10))
    .filter((amount) => Number.isFinite(amount) && amount >= 100);

  return fallback.length > 0 ? Math.max(...fallback) : undefined;
}

function extractDate(text: string) {
  const ymd =
    text.match(/(20\d{2})[\/.\-年 ]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})(?:日)?/) ??
    text.match(/(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);

  if (!ymd) {
    return undefined;
  }

  if (ymd[1].length === 2) {
    const year = 2000 + parseInt(ymd[1], 10);
    return toDateString(year, parseInt(ymd[2], 10), parseInt(ymd[3], 10));
  }

  return toDateString(parseInt(ymd[1], 10), parseInt(ymd[2], 10), parseInt(ymd[3], 10));
}

function extractMerchantName(lines: string[]) {
  return lines.find(
    (line) =>
      !/[0-9]{2,}/.test(line) &&
      !TOTAL_LABEL_PATTERN.test(line) &&
      !RECEIPT_SKIP_PATTERN.test(line) &&
      line.length >= 2 &&
      line.length <= 28,
  );
}

function extractReceiptItems(lines: string[]): OcrReceiptItem[] {
  return lines
    .map((line) => parseReceiptItemLine(line))
    .filter((item): item is OcrReceiptItem => Boolean(item))
    .slice(0, 20);
}

function parseReceiptItemLine(line: string): OcrReceiptItem | null {
  if (TOTAL_LABEL_PATTERN.test(line) || RECEIPT_SKIP_PATTERN.test(line) || DATE_LINE_PATTERN.test(line)) {
    return null;
  }

  const normalized = line.replace(/[¥,]/g, " ").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)(\d{2,5})\s*(?:円)?\s*$/);
  if (!match) {
    return null;
  }

  const itemNameRaw = match[1].trim().replace(/^[*\-•]+/, "").trim();
  const totalPrice = parseInt(match[2], 10);
  if (!itemNameRaw || !Number.isFinite(totalPrice) || totalPrice <= 0) {
    return null;
  }

  if (isMostlyNumeric(itemNameRaw) || DATE_LINE_PATTERN.test(itemNameRaw)) {
    return null;
  }

  const normalizedItemName = normalizeItemName(itemNameRaw);
  if (!normalizedItemName) {
    return null;
  }

  const quantityMeta = extractQuantity(itemNameRaw);
  return {
    itemName: itemNameRaw,
    normalizedItemName,
    quantity: quantityMeta?.quantity,
    quantityUnit: quantityMeta?.unit,
    unitPrice: quantityMeta?.quantity ? Math.round((totalPrice / quantityMeta.quantity) * 100) / 100 : undefined,
    totalPrice,
    sourceText: line,
  };
}

function extractQuantity(itemName: string) {
  const match = itemName.match(QUANTITY_PATTERN);
  if (!match) {
    return undefined;
  }

  const rawQuantity = parseFloat(match[1]);
  const unit = normalizeUnit(match[2]);
  const quantity = unit === "g" && match[2].toLowerCase() === "kg" ? rawQuantity * 1000 : unit === "ml" && /^(l|L)$/.test(match[2]) ? rawQuantity * 1000 : rawQuantity;

  return { quantity, unit };
}

function normalizeUnit(unit: string) {
  const lower = unit.toLowerCase();
  if (lower === "kg") return "g";
  if (lower === "l") return "ml";
  if (lower === "p") return "パック";
  if (unit === "mL") return "ml";
  return unit;
}

function normalizeItemName(itemName: string) {
  return itemName
    .replace(QUANTITY_PATTERN, "")
    .replace(/[0-9]+(?:円)?/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim()
    .toLowerCase();
}

function extractMedicalFacility(lines: string[]) {
  return (
    lines.find((line) => /(病院|医院|クリニック|歯科|薬局|診療所)/.test(line) && line.length <= 32) ??
    extractMerchantName(lines)
  );
}

function inferMedicalType(text: string): MedicalType {
  if (/薬局|調剤/.test(text)) {
    return "医薬品購入";
  }
  if (/病院|クリニック|診療所|処方/.test(text)) {
    return "診療・治療";
  }
  if (/整体|マッサージ|コンタクト/.test(text)) {
    return "その他の医療費";
  }
  if (/歯|口腔/.test(text)) {
    return "診療・治療";
  }
  return "診療・治療";
}

function isMostlyNumeric(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) {
    return true;
  }

  const stripped = compact.replace(/[0-9:/\-年月日時分]/g, "");
  return stripped.length <= 1;
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
