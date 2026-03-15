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

type TesseractModule = typeof import("tesseract.js");
type TesseractWorker = Awaited<ReturnType<TesseractModule["createWorker"]>>;

const OCR_LANGS = ["jpn", "eng"] as const;
const OCR_VERSION = "7.0.0";
const OCR_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSION}`;
const OCR_CORE_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js-core@v${OCR_VERSION}`;
const OCR_LANG_BASE = "https://tessdata.projectnaptha.com/4.0.0";
const OCR_MAX_EDGE = 2200;
const OCR_MIN_EDGE = 1400;

const TOTAL_LABEL_PATTERN = /(合計|総計|現計|小計|お預り|お釣り|税込|税抜|クレジット|電子マネー|ポイント|値引|割引|TEL|電話)/i;
const RECEIPT_SKIP_PATTERN = /(領収|レシート|ありがとうございました|承認|取引|伝票|No\.?|番号|内訳|担当|担当者)/i;
const DATE_LINE_PATTERN = /(20\d{2}|\d{2})[\/.\-年]\s*\d{1,2}[\/.\-月]\s*\d{1,2}(?:日)?|\d{1,2}:\d{2}/;
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s?(kg|g|ml|mL|l|L|個|本|枚|袋|パック|P|p|缶|玉|箱)/;

let workerPromise: Promise<TesseractWorker> | null = null;
let workerQueue: Promise<unknown> = Promise.resolve();

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
  const preparedImage = await prepareImageForOcr(imageData);

  try {
    const worker = await getWorker();
    const result = await enqueueOcrJob(async () => worker.recognize(preparedImage, { rotateAuto: true }));

    return {
      text: normalizeOcrText(result.data.text),
      confidence: result.data.confidence ?? 0,
    };
  } catch (workerError) {
    const fallback = await runDirectRecognize(preparedImage).catch((fallbackError) => {
      const workerMessage = workerError instanceof Error ? workerError.message : "worker initialization failed";
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "fallback recognize failed";
      throw new Error(`OCR failed: ${workerMessage}; fallback failed: ${fallbackMessage}`);
    });

    return fallback;
  }
}

async function runDirectRecognize(imageData: string) {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(imageData, OCR_LANGS.join("+"), {
    logger: () => undefined,
  });

  return {
    text: normalizeOcrText(result.data.text),
    confidence: result.data.confidence ?? 0,
  };
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createOcrWorker();
  }

  return workerPromise;
}

async function createOcrWorker() {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker([...OCR_LANGS], 1, {
    workerPath: `${OCR_BASE}/dist/worker.min.js`,
    corePath: OCR_CORE_BASE,
    langPath: OCR_LANG_BASE,
    cacheMethod: "write",
    gzip: true,
    logger: () => undefined,
    errorHandler: () => undefined,
  });

  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
  });

  return worker;
}

function enqueueOcrJob<T>(job: () => Promise<T>) {
  const nextJob = workerQueue.then(job, job);
  workerQueue = nextJob.then(
    () => undefined,
    () => undefined,
  );

  return nextJob;
}

async function prepareImageForOcr(imageData: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return imageData;
  }

  const image = await loadImage(imageData);
  const longestEdge = Math.max(image.width, image.height);
  const upscaleRatio = longestEdge < OCR_MIN_EDGE ? OCR_MIN_EDGE / longestEdge : 1;
  const downscaleRatio = longestEdge > OCR_MAX_EDGE ? OCR_MAX_EDGE / longestEdge : 1;
  const ratio = Math.min(Math.max(upscaleRatio, downscaleRatio), 2);

  if (ratio === 1 && longestEdge <= OCR_MAX_EDGE && longestEdge >= OCR_MIN_EDGE) {
    return imageData;
  }

  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return imageData;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.filter = "grayscale(1) contrast(1.18) brightness(1.05)";
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("failed to decode image"));
    image.src = source;
  });
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
  const quantity =
    unit === "g" && match[2].toLowerCase() === "kg"
      ? rawQuantity * 1000
      : unit === "ml" && /^(l|L)$/.test(match[2])
        ? rawQuantity * 1000
        : rawQuantity;

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
  if (/介護/.test(text)) {
    return "介護保険サービス";
  }
  if (/整体|マッサージ|コンタクト/.test(text)) {
    return "その他の医療費";
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
