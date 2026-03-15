import type { MedicalType } from "@/types";
import { MEDICAL_TYPES } from "@/types";

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

export type OcrEngine = "gemini" | "tesseract";

export interface OcrScanResult<TDraft> {
  confidence: number | null;
  draft: TDraft;
  text: string;
  engine: OcrEngine;
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

interface GeminiExpenseDraft {
  amount?: number | null;
  date?: string | null;
  shopName?: string | null;
  memo?: string | null;
  items?: Array<{
    itemName?: string | null;
    quantity?: number | null;
    quantityUnit?: string | null;
    totalPrice?: number | null;
  }>;
}

interface GeminiMedicalDraft {
  amount?: number | null;
  date?: string | null;
  hospitalName?: string | null;
  medicalTypeHint?: string | null;
}

type GeminiExpenseItem = NonNullable<GeminiExpenseDraft["items"]>[number];

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
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
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TRANSPORTATION_MEDICAL_TYPE = "騾夐劼莠､騾夊ｲｻ" as MedicalType;

const TOTAL_LABEL_PATTERN =
  /(合計|総合計|支払額|お買上額|請求額|料金|total|amount|蜷郁ｨ|邱剰ｨ|迴ｾ險|蟆剰ｨ|縺企|遞手ｾｼ|髮ｻ隧ｱ)/i;
const RECEIPT_SKIP_PATTERN =
  /(レシート|ありがとうございました|領収書|登録番号|電話|tel|税込|税抜|内税|外税|No\.?|No:|逡ｪ蜿ｷ|蜀・ｨｳ)/i;
const DATE_LINE_PATTERN =
  /(20\d{2}|\d{2})[\/.\-年]\s*\d{1,2}[\/.\-月]\s*\d{1,2}(?:日)?|\d{1,2}:\d{2}/;
const QUANTITY_PATTERN =
  /(\d+(?:\.\d+)?)\s?(kg|g|ml|mL|l|L|本|袋|パック|P|p|個|枚|蛟弓譛ｬ|譫嘶陲弓繝代ャ繧ｯ|郛ｶ|邇榎邂ｱ)/i;

let workerPromise: Promise<TesseractWorker> | null = null;
let workerQueue: Promise<unknown> = Promise.resolve();

export async function recognizeExpenseReceipt(imageData: string): Promise<OcrScanResult<ExpenseOcrDraft>> {
  const preparedImage = await prepareImageForOcr(imageData);
  const errors: string[] = [];

  try {
    return await runGeminiExpenseOcr(preparedImage);
  } catch (error) {
    errors.push(`Gemini: ${toErrorMessage(error)}`);
  }

  try {
    const { text, confidence } = await runTesseractOcr(preparedImage);
    return {
      confidence,
      draft: parseExpenseOcrText(text),
      text,
      engine: "tesseract",
    };
  } catch (error) {
    errors.push(`Tesseract: ${toErrorMessage(error)}`);
  }

  throw new Error(`OCR failed. ${errors.join(" / ")}`);
}

export async function recognizeMedicalReceipt(imageData: string): Promise<OcrScanResult<MedicalOcrDraft>> {
  const preparedImage = await prepareImageForOcr(imageData);
  const errors: string[] = [];

  try {
    return await runGeminiMedicalOcr(preparedImage);
  } catch (error) {
    errors.push(`Gemini: ${toErrorMessage(error)}`);
  }

  try {
    const { text, confidence } = await runTesseractOcr(preparedImage);
    return {
      confidence,
      draft: parseMedicalOcrText(text),
      text,
      engine: "tesseract",
    };
  } catch (error) {
    errors.push(`Tesseract: ${toErrorMessage(error)}`);
  }

  throw new Error(`OCR failed. ${errors.join(" / ")}`);
}

export function parseExpenseOcrText(text: string): ExpenseOcrDraft {
  const cleaned = normalizeOcrText(text);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const amount = extractAmount(lines);
  const date = extractDate(cleaned);
  const shopName = extractMerchantName(lines);

  return {
    amount,
    date,
    items: extractReceiptItems(lines),
    shopName,
    memo: shopName ? `${shopName} OCR` : undefined,
  };
}

export function parseMedicalOcrText(text: string): MedicalOcrDraft {
  const cleaned = normalizeOcrText(text);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

async function runGeminiExpenseOcr(imageData: string): Promise<OcrScanResult<ExpenseOcrDraft>> {
  const parsed = await runGeminiJson<GeminiExpenseDraft>(
    imageData,
    [
      "Read this Japanese shopping receipt image.",
      "Return JSON only.",
      "Schema:",
      "{",
      '  "amount": number | null,',
      '  "date": "YYYY-MM-DD" | null,',
      '  "shopName": string | null,',
      '  "memo": string | null,',
      '  "items": [{ "itemName": string, "quantity": number | null, "quantityUnit": string | null, "totalPrice": number | null }]',
      "}",
      "Rules:",
      "- amount is the grand total paid on the receipt.",
      "- date must be normalized to YYYY-MM-DD when possible.",
      "- items must include only purchased product lines, not totals, taxes, points, discounts, phone numbers, addresses, or store metadata.",
      "- totalPrice must be an integer yen amount for that line.",
      "- quantity and quantityUnit are optional. Infer from labels like 1000ml, 2個, 1kg, 3本.",
      "- If uncertain, use null instead of guessing.",
    ].join("\n"),
  );

  const items = (parsed.items ?? [])
    .map((item) => toReceiptItem(item))
    .filter(isDefined);

  const draft: ExpenseOcrDraft = {
    amount: toPositiveNumber(parsed.amount),
    date: normalizeGeminiDate(parsed.date),
    shopName: cleanOptionalText(parsed.shopName),
    memo: cleanOptionalText(parsed.memo) ?? undefined,
    items,
  };

  if (!draft.memo && draft.shopName) {
    draft.memo = `${draft.shopName} OCR`;
  }

  return {
    confidence: null,
    draft,
    text: JSON.stringify(parsed, null, 2),
    engine: "gemini",
  };
}

async function runGeminiMedicalOcr(imageData: string): Promise<OcrScanResult<MedicalOcrDraft>> {
  const parsed = await runGeminiJson<GeminiMedicalDraft>(
    imageData,
    [
      "Read this Japanese medical receipt or pharmacy receipt image.",
      "Return JSON only.",
      "Schema:",
      "{",
      '  "amount": number | null,',
      '  "date": "YYYY-MM-DD" | null,',
      '  "hospitalName": string | null,',
      '  "medicalTypeHint": "consultation" | "medicine" | "nursing" | "therapy" | "transportation" | null',
      "}",
      "Rules:",
      "- amount is the total paid by the user.",
      "- date must be normalized to YYYY-MM-DD when possible.",
      "- hospitalName should be the clinic, hospital, or pharmacy name.",
      "- consultation means general treatment/doctor visit.",
      "- medicine means pharmacy / prescription cost.",
      "- nursing means nursing care service.",
      "- therapy means massage, rehab, or similar.",
      "- transportation means transit cost related to treatment.",
      "- If uncertain, use null instead of guessing.",
    ].join("\n"),
  );

  return {
    confidence: null,
    draft: {
      amount: toPositiveNumber(parsed.amount),
      date: normalizeGeminiDate(parsed.date),
      hospitalName: cleanOptionalText(parsed.hospitalName),
      medicalType: mapGeminiMedicalType(parsed.medicalTypeHint),
    },
    text: JSON.stringify(parsed, null, 2),
    engine: "gemini",
  };
}

async function runGeminiJson<T>(imageData: string, prompt: string): Promise<T> {
  const apiKey = globalThis.__APP_GEMINI_API_KEY__?.trim();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const { mimeType, data } = splitDataUrl(imageData);
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const text = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (!text) {
    throw new Error("Gemini response did not contain JSON text");
  }

  return JSON.parse(stripCodeFence(text)) as T;
}

async function runTesseractOcr(imageData: string) {
  try {
    const worker = await getWorker();
    const result = await enqueueOcrJob(async () => worker.recognize(imageData, { rotateAuto: true }));

    return {
      text: normalizeOcrText(result.data.text),
      confidence: result.data.confidence ?? 0,
    };
  } catch (workerError) {
    const fallback = await runDirectRecognize(imageData).catch((fallbackError) => {
      throw new Error(`${toErrorMessage(workerError)}; fallback failed: ${toErrorMessage(fallbackError)}`);
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
      const normalized = line.replace(/[¥￥,，．｡]/g, "");
      return Array.from(normalized.matchAll(/(?:合計|総合計|支払額|お買上額|請求額|料金|蜷郁ｨ|邱剰ｨ|迴ｾ險|遞手ｾｼ|縺企)[^\d]{0,6}([0-9]{2,7})/g)).map((match) => ({
        amount: parseInt(match[1], 10),
        priority: TOTAL_LABEL_PATTERN.test(line) ? 100 : 20,
      }));
    })
    .filter((candidate) => Number.isFinite(candidate.amount) && candidate.amount > 0);

  if (labeled.length > 0) {
    return labeled.sort((left, right) => right.priority - left.priority || right.amount - left.amount)[0].amount;
  }

  const fallback = lines
    .flatMap((line) => Array.from(line.replace(/[¥￥,，．｡]/g, "").matchAll(/([0-9]{2,7})/g)))
    .map((match) => parseInt(match[1], 10))
    .filter((amount) => Number.isFinite(amount) && amount >= 100);

  return fallback.length > 0 ? Math.max(...fallback) : undefined;
}

function extractDate(text: string) {
  const ymd =
    text.match(/(20\d{2})[\/.\-年 ]\s*(\d{1,2})[\/.\-月 ]\s*(\d{1,2})(?:日)?/) ??
    text.match(/(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);

  if (!ymd) {
    return undefined;
  }

  if (ymd[1].length === 2) {
    return toDateString(2000 + parseInt(ymd[1], 10), parseInt(ymd[2], 10), parseInt(ymd[3], 10));
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
      line.length <= 32,
  );
}

function extractReceiptItems(lines: string[]) {
  return lines
    .map((line) => parseReceiptItemLine(line))
    .filter((item): item is OcrReceiptItem => Boolean(item))
    .slice(0, 20);
}

function parseReceiptItemLine(line: string): OcrReceiptItem | null {
  if (TOTAL_LABEL_PATTERN.test(line) || RECEIPT_SKIP_PATTERN.test(line) || DATE_LINE_PATTERN.test(line)) {
    return null;
  }

  const normalized = line.replace(/[¥￥,，]/g, " ").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)(\d{2,6})\s*$/);
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
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {
    return undefined;
  }

  const rawUnit = match[2];
  const unit = normalizeUnit(rawUnit);
  const quantity =
    unit === "g" && /^kg$/i.test(rawUnit)
      ? rawQuantity * 1000
      : unit === "ml" && /^l$/i.test(rawUnit)
        ? rawQuantity * 1000
        : rawQuantity;

  return { quantity, unit };
}

function normalizeUnit(unit: string) {
  const lower = unit.toLowerCase();
  if (lower === "kg") return "g";
  if (lower === "l") return "ml";
  if (lower === "ml") return "ml";
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
    lines.find((line) => /(医院|病院|クリニック|薬局|歯科|逞・劼|蛹ｻ髯｢|豁ｯ遘掃阮ｬ螻|險ｺ逋よ園)/.test(line) && line.length <= 40) ??
    extractMerchantName(lines)
  );
}

function inferMedicalType(text: string): MedicalType {
  if (/電車|バス|タクシー|transport|騾夐劼|莠､騾夊ｲｻ/.test(text)) {
    return TRANSPORTATION_MEDICAL_TYPE;
  }
  if (/薬局|調剤|処方|pharmacy|medicine|阮ｬ螻|隱ｿ蜑､/.test(text)) {
    return MEDICAL_TYPES[1];
  }
  if (/介護|nursing|莉玖ｭｷ/.test(text)) {
    return MEDICAL_TYPES[2];
  }
  if (/あんま|マッサージ|リハビリ|整体|therapy|謨ｴ菴|繝槭ャ繧ｵ|繧ｳ繝ｳ繧ｿ繧ｯ/.test(text)) {
    return MEDICAL_TYPES[3];
  }
  return MEDICAL_TYPES[0];
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

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("invalid image data");
  }

  return {
    mimeType: match[1] || "image/jpeg",
    data: match[2],
  };
}

function stripCodeFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function toPositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function cleanOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizeGeminiDate(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return extractDate(value);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function toReceiptItem(item: GeminiExpenseItem): OcrReceiptItem | null {
  const itemName = cleanOptionalText(item?.itemName);
  const totalPrice = toPositiveNumber(item?.totalPrice);
  if (!itemName || !totalPrice) {
    return null;
  }

  const normalizedItemName = normalizeItemName(itemName);
  if (!normalizedItemName) {
    return null;
  }

  const quantity = typeof item?.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
    ? item.quantity
    : undefined;
  const quantityUnit = cleanOptionalText(item?.quantityUnit);

  return {
    itemName,
    normalizedItemName,
    quantity,
    quantityUnit,
    totalPrice,
    unitPrice: quantity ? Math.round((totalPrice / quantity) * 100) / 100 : undefined,
    sourceText: `${itemName} ${totalPrice}`,
  };
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function mapGeminiMedicalType(value: string | null | undefined): MedicalType | undefined {
  switch (value?.trim().toLowerCase()) {
    case "consultation":
      return MEDICAL_TYPES[0];
    case "medicine":
      return MEDICAL_TYPES[1];
    case "nursing":
      return MEDICAL_TYPES[2];
    case "therapy":
      return MEDICAL_TYPES[3];
    case "transportation":
      return TRANSPORTATION_MEDICAL_TYPE;
    default:
      return undefined;
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
