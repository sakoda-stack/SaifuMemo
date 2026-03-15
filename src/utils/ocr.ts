import type { MedicalType } from "@/types";

export interface ExpenseOcrDraft {
  amount?: number;
  date?: string;
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
    shopName,
    memo: shopName ? `${shopName}のレシートからOCR候補` : undefined,
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
  const candidates = lines
    .flatMap((line) => {
      const normalized = line.replace(/[¥￥]/g, "").replace(/,/g, "");
      return Array.from(normalized.matchAll(/(?:合計|計|総計|現計|領収金額|ご請求額)?\s*([0-9]{2,7})\s*円?/g)).map((match) => ({
        amount: parseInt(match[1], 10),
        priority: /合計|総計|請求/.test(line) ? 100 : 10,
      }));
    })
    .filter((candidate) => Number.isFinite(candidate.amount) && candidate.amount > 0);

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.sort((left, right) => right.priority - left.priority || right.amount - left.amount)[0].amount;
}

function extractDate(text: string) {
  const ymd =
    text.match(/(20\d{2})[\/.\-年 ]\s*(\d{1,2})[\/.\-月 ]\s*(\d{1,2})/) ??
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
      !/TEL|合計|現金|カード|小計|レシート|ありがとうございました|税込|税抜/i.test(line) &&
      line.length >= 2 &&
      line.length <= 28,
  );
}

function extractMedicalFacility(lines: string[]) {
  return (
    lines.find((line) => /(病院|医院|クリニック|歯科|薬局)/.test(line) && line.length <= 32) ??
    extractMerchantName(lines)
  );
}

function inferMedicalType(text: string): MedicalType {
  if (/介護/.test(text)) {
    return "介護保険サービス";
  }
  if (/薬局|ドラッグ|処方|調剤/.test(text)) {
    return "医薬品購入";
  }
  if (/交通|電車|バス|運賃|タクシー/.test(text)) {
    return "通院交通費";
  }
  if (/文書|診断書|差額|雑費/.test(text)) {
    return "その他の医療費";
  }
  return "診療・治療";
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
