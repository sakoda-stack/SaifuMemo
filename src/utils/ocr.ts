import { MEDICAL_TYPES, type MedicalType } from "@/types";
import { normalizeDateInput } from "@/utils";
import { normalizeProductKey } from "@/utils/compare";

export interface OcrFieldCandidate {
  value: string;
  sourceText?: string;
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

export interface ExpenseOcrDraft {
  amount?: number;
  date?: string;
  shopName?: string;
  memo?: string;
  items: OcrReceiptItem[];
  notes: string[];
}

export interface MedicalOcrDraft {
  amount?: number;
  date?: string;
  hospitalName?: string;
  medicalType?: MedicalType;
  hospitalCandidates: OcrFieldCandidate[];
  medicalTypeCandidates: MedicalType[];
  medicineCandidates: OcrFieldCandidate[];
  memoCandidates: OcrFieldCandidate[];
}

export type OcrEngine = "gemini" | "tesseract";

export interface OcrScanResult<TDraft> {
  confidence: number | null;
  draft: TDraft;
  text: string;
  engine: OcrEngine;
}

interface GeminiExpenseDraft {
  amount?: number | null;
  date?: string | null;
  shopName?: string | null;
  memo?: string | null;
  noteCandidates?: string[] | null;
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
  medicalTypeHints?: string[] | null;
  medicineCandidates?: string[] | null;
  noteCandidates?: string[] | null;
  hospitalCandidates?: string[] | null;
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
const TRANSPORTATION_MEDICAL_TYPE = "通院交通費" as MedicalType;

const TOTAL_LABEL_PATTERN = /(合計|総合計|支払額|お買上額|請求額|料金|ご利用額|total|amount)/i;
const RECEIPT_SKIP_PATTERN = /(領収書|ありがとうございました|登録番号|電話|tel|税込|税抜|内税|外税|ポイント|クレジット|visa|master|receipt|レシート)/i;
const DATE_PATTERN = /(20\d{2}|\d{2})[\/.\-年 ]\s*(\d{1,2})[\/.\-月 ]\s*(\d{1,2})(?:日)?/;
const TIME_PATTERN = /\d{1,2}:\d{2}/;
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s?(kg|g|ml|mL|l|L|本|袋|パック|P|p|個|枚|束|玉|箱)/i;
const MEDICAL_FACILITY_PATTERN = /(医院|病院|クリニック|診療所|薬局|歯科|耳鼻科|小児科|整形外科|皮膚科|内科|眼科|外科)/;
const MEDICINE_PATTERN = /(錠|mg|mL|ml|カプセル|シロップ|顆粒|散|処方|薬)/i;

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
  const lines = toLines(cleaned);
  const shopName = extractMerchantName(lines);
  const items = extractReceiptItems(lines);

  return {
    amount: extractAmount(lines),
    date: extractDate(cleaned),
    shopName,
    memo: shopName ? `${shopName} OCR` : undefined,
    items,
    notes: buildExpenseNotes(lines, items),
  };
}

export function parseMedicalOcrText(text: string): MedicalOcrDraft {
  const cleaned = normalizeOcrText(text);
  const lines = toLines(cleaned);
  const hospitalCandidates = collectHospitalCandidates(lines);
  const medicalTypeCandidates = collectMedicalTypeCandidates(cleaned);
  const medicineCandidates = collectMedicineCandidates(lines);
  const memoCandidates = collectMedicalMemoCandidates(lines);

  return {
    amount: extractAmount(lines),
    date: extractDate(cleaned),
    hospitalName: hospitalCandidates[0]?.value,
    medicalType: medicalTypeCandidates[0],
    hospitalCandidates,
    medicalTypeCandidates,
    medicineCandidates,
    memoCandidates,
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
      '  "noteCandidates": string[] | null,',
      '  "items": [{ "itemName": string, "quantity": number | null, "quantityUnit": string | null, "totalPrice": number | null }]',
      "}",
      "Rules:",
      "- amount is the grand total paid.",
      "- date must be normalized to YYYY-MM-DD if possible.",
      "- items must contain only purchased products.",
      "- Do not invent missing prices or quantities.",
      "- noteCandidates can include short useful notes such as campaign, branch, or memo-worthy text.",
    ].join("\n"),
  );

  const items = (parsed.items ?? []).map(toReceiptItem).filter(isDefined);
  const notes = (parsed.noteCandidates ?? []).map(cleanOptionalText).filter(isDefined);
  const shopName = cleanOptionalText(parsed.shopName);

  return {
    confidence: null,
    draft: {
      amount: toPositiveNumber(parsed.amount),
      date: normalizeGeminiDate(parsed.date),
      shopName,
      memo: cleanOptionalText(parsed.memo) ?? (shopName ? `${shopName} OCR` : undefined),
      items,
      notes,
    },
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
      '  "hospitalCandidates": string[] | null,',
      '  "medicalTypeHint": "consultation" | "medicine" | "nursing" | "therapy" | "transportation" | null,',
      '  "medicalTypeHints": string[] | null,',
      '  "medicineCandidates": string[] | null,',
      '  "noteCandidates": string[] | null',
      "}",
      "Rules:",
      "- amount is the total paid by the user.",
      "- hospitalName should be the clinic, hospital, or pharmacy name if identifiable.",
      "- medicineCandidates should include medicine names or prescription labels only when visible.",
      "- noteCandidates can include service labels such as 初診, 再診, 調剤, 検査, 処方.",
      "- If uncertain, use null or an empty list instead of guessing.",
    ].join("\n"),
  );

  const medicalTypeCandidates = [
    mapGeminiMedicalType(parsed.medicalTypeHint),
    ...(parsed.medicalTypeHints ?? []).map(mapGeminiMedicalType),
  ].filter(isDefined);

  const hospitalCandidates = (parsed.hospitalCandidates ?? [])
    .map(cleanOptionalText)
    .filter(isDefined)
    .map((value) => ({ value }));

  const medicineCandidates = (parsed.medicineCandidates ?? [])
    .map(cleanOptionalText)
    .filter(isDefined)
    .map((value) => ({ value }));

  const memoCandidates = (parsed.noteCandidates ?? [])
    .map(cleanOptionalText)
    .filter(isDefined)
    .map((value) => ({ value }));

  const hospitalName = cleanOptionalText(parsed.hospitalName);
  if (hospitalName && hospitalCandidates.every((candidate) => candidate.value !== hospitalName)) {
    hospitalCandidates.unshift({ value: hospitalName });
  }

  return {
    confidence: null,
    draft: {
      amount: toPositiveNumber(parsed.amount),
      date: normalizeGeminiDate(parsed.date),
      hospitalName,
      medicalType: medicalTypeCandidates[0],
      hospitalCandidates,
      medicalTypeCandidates,
      medicineCandidates,
      memoCandidates,
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
  const result = await recognize(imageData, OCR_LANGS.join("+"), { logger: () => undefined });

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
  context.filter = "grayscale(1) contrast(1.18) brightness(1.04)";
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

function toLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractAmount(lines: string[]) {
  const labeled = lines
    .flatMap((line) => {
      const normalized = line.replace(/[¥￥,，．｡]/g, "");
      return Array.from(normalized.matchAll(/(?:合計|総合計|支払額|お買上額|請求額|料金|ご利用額)[^\d]{0,6}([0-9]{2,7})/g)).map((match) => ({
        amount: parseInt(match[1], 10),
        priority: TOTAL_LABEL_PATTERN.test(line) ? 100 : 10,
      }));
    })
    .filter((candidate) => Number.isFinite(candidate.amount) && candidate.amount > 0);

  if (labeled.length > 0) {
    return labeled.sort((left, right) => right.priority - left.priority || right.amount - left.amount)[0].amount;
  }

  const values = lines
    .flatMap((line) => Array.from(line.replace(/[¥￥,，．｡]/g, "").matchAll(/([0-9]{3,7})/g)))
    .map((match) => parseInt(match[1], 10))
    .filter((amount) => Number.isFinite(amount) && amount >= 100);

  return values.length > 0 ? Math.max(...values) : undefined;
}

function extractDate(text: string) {
  const matched = text.match(DATE_PATTERN);
  if (!matched) {
    return undefined;
  }

  const year = matched[1].length === 2 ? 2000 + parseInt(matched[1], 10) : parseInt(matched[1], 10);
  const month = parseInt(matched[2], 10);
  const day = parseInt(matched[3], 10);

  return normalizeDateInput(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function extractMerchantName(lines: string[]) {
  return lines.find(
    (line) =>
      !/[0-9]{3,}/.test(line) &&
      !TIME_PATTERN.test(line) &&
      !TOTAL_LABEL_PATTERN.test(line) &&
      !RECEIPT_SKIP_PATTERN.test(line) &&
      line.length >= 2 &&
      line.length <= 40,
  );
}

function extractReceiptItems(lines: string[]) {
  return lines.map(parseReceiptItemLine).filter((item): item is OcrReceiptItem => Boolean(item)).slice(0, 30);
}

function parseReceiptItemLine(line: string): OcrReceiptItem | null {
  if (TOTAL_LABEL_PATTERN.test(line) || RECEIPT_SKIP_PATTERN.test(line) || DATE_PATTERN.test(line) || TIME_PATTERN.test(line)) {
    return null;
  }

  const normalized = line.replace(/[¥￥,，]/g, " ").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)(\d{2,6})\s*$/);
  if (!match) {
    return null;
  }

  const itemName = match[1].trim().replace(/^[*\-•]+/, "").trim();
  const totalPrice = parseInt(match[2], 10);

  if (!itemName || !Number.isFinite(totalPrice) || totalPrice <= 0 || isMostlyNumeric(itemName)) {
    return null;
  }

  const normalizedItemName = normalizeProductKey(itemName);
  if (!normalizedItemName) {
    return null;
  }

  const quantity = extractQuantity(itemName);

  return {
    itemName,
    normalizedItemName,
    quantity: quantity?.quantity,
    quantityUnit: quantity?.unit,
    totalPrice,
    unitPrice: quantity?.quantity ? Math.round((totalPrice / quantity.quantity) * 100) / 100 : undefined,
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
  if (lower === "ml" || unit === "mL") return "ml";
  if (lower === "p") return "パック";
  return unit;
}

function collectHospitalCandidates(lines: string[]) {
  const unique = new Set<string>();
  const candidates: OcrFieldCandidate[] = [];

  lines.forEach((line) => {
    if (line.length > 48 || RECEIPT_SKIP_PATTERN.test(line) || TOTAL_LABEL_PATTERN.test(line)) {
      return;
    }
    if (!MEDICAL_FACILITY_PATTERN.test(line) && /[0-9]{3,}/.test(line)) {
      return;
    }

    if (MEDICAL_FACILITY_PATTERN.test(line) || (!/[0-9]{3,}/.test(line) && line.length >= 3 && line.length <= 24)) {
      if (!unique.has(line)) {
        unique.add(line);
        candidates.push({ value: line, sourceText: line });
      }
    }
  });

  return candidates;
}

function collectMedicalTypeCandidates(text: string): MedicalType[] {
  const candidates: MedicalType[] = [];

  if (/電車|バス|タクシー|交通費|通院交通費/i.test(text)) {
    candidates.push(TRANSPORTATION_MEDICAL_TYPE);
  }
  if (/薬局|調剤|処方|服薬|medicine|pharmacy/i.test(text)) {
    candidates.push("医薬品購入");
  }
  if (/介護|訪問看護|デイサービス|nursing/i.test(text)) {
    candidates.push("介護保険サービス");
  }
  if (/リハビリ|マッサージ|整体|therapy/i.test(text)) {
    candidates.push("その他の医療費");
  }
  if (/診察|再診|初診|医院|病院|クリニック|診療所/i.test(text)) {
    candidates.push("診療・治療");
  }

  return dedupe(candidates.length > 0 ? candidates : ["診療・治療"]);
}

function collectMedicineCandidates(lines: string[]) {
  return dedupe(
    lines
      .filter((line) => MEDICINE_PATTERN.test(line) && !TOTAL_LABEL_PATTERN.test(line) && !/[0-9]{4,}/.test(line))
      .map((line) => ({ value: line, sourceText: line })),
    (candidate) => candidate.value,
  ).slice(0, 8);
}

function collectMedicalMemoCandidates(lines: string[]) {
  return dedupe(
    lines
      .filter((line) => /(初診|再診|調剤|検査|診察|処方|保険|自己負担|公費)/.test(line))
      .map((line) => ({ value: line, sourceText: line })),
    (candidate) => candidate.value,
  ).slice(0, 8);
}

function buildExpenseNotes(lines: string[], items: OcrReceiptItem[]) {
  const itemSource = new Set(items.map((item) => item.sourceText));
  return lines
    .filter((line) => !itemSource.has(line) && !TOTAL_LABEL_PATTERN.test(line) && !DATE_PATTERN.test(line))
    .filter((line) => line.length >= 4 && line.length <= 40)
    .slice(0, 5);
}

function isMostlyNumeric(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) {
    return true;
  }

  const stripped = compact.replace(/[0-9:/\-年月日時分]/g, "");
  return stripped.length <= 1;
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("invalid image data");
  }

  return { mimeType: match[1] || "image/jpeg", data: match[2] };
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

  const normalizedItemName = normalizeProductKey(itemName);
  if (!normalizedItemName) {
    return null;
  }

  const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : undefined;
  const quantityUnit = cleanOptionalText(item.quantityUnit);

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

function mapGeminiMedicalType(value: string | null | undefined): MedicalType | undefined {
  switch (value?.trim().toLowerCase()) {
    case "consultation":
      return "診療・治療";
    case "medicine":
      return "医薬品購入";
    case "nursing":
      return "介護保険サービス";
    case "therapy":
      return "その他の医療費";
    case "transportation":
      return TRANSPORTATION_MEDICAL_TYPE;
    default:
      return undefined;
  }
}

function dedupe<T>(values: T[], keyGetter?: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyGetter ? keyGetter(value) : String(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
