import type { ReceiptItemObservation } from "@/types";

export type ComparisonBasis = "unit" | "total";
export type ComparisonConfidence = "strong" | "reference";

export interface ShopProductInsight {
  shopId?: string;
  shopName: string;
  itemLabel: string;
  normalizedItemName: string;
  comparisonBasis: ComparisonBasis;
  comparisonPrice: number;
  quantityUnit?: string;
  latestDate: string;
  sampleCount: number;
  confidence: ComparisonConfidence;
  totalPriceMedian: number;
  unitPriceMedian?: number;
  observations: ReceiptItemObservation[];
}

export interface ProductComparison {
  itemLabel: string;
  normalizedItemName: string;
  comparisonBasis: ComparisonBasis;
  confidence: ComparisonConfidence;
  shops: ShopProductInsight[];
  best: ShopProductInsight;
  runnerUp?: ShopProductInsight;
  priceGap?: number;
}

export interface StoreSummary {
  shopName: string;
  winCount: number;
  strongWinCount: number;
  averageWinningPrice: number;
  winningItems: ProductComparison[];
}

export function buildProductComparisons(observations: ReceiptItemObservation[]): ProductComparison[] {
  const groupedByProduct = new Map<string, ReceiptItemObservation[]>();

  observations.forEach((observation) => {
    const normalizedItemName = normalizeProductKey(observation.normalizedItemName || observation.itemName);
    const shopName = normalizeShopLabel(observation.shopName);
    if (!normalizedItemName || !shopName) {
      return;
    }

    const row = { ...observation, normalizedItemName, shopName };
    groupedByProduct.set(normalizedItemName, [...(groupedByProduct.get(normalizedItemName) ?? []), row]);
  });

  return Array.from(groupedByProduct.entries())
    .map(([normalizedItemName, rows]) => buildSingleProductComparison(normalizedItemName, rows))
    .filter((comparison): comparison is ProductComparison => Boolean(comparison))
    .sort((left, right) => {
      if ((right.priceGap ?? 0) !== (left.priceGap ?? 0)) {
        return (right.priceGap ?? 0) - (left.priceGap ?? 0);
      }

      return left.itemLabel.localeCompare(right.itemLabel, "ja");
    });
}

export function buildStoreSummaries(comparisons: ProductComparison[]): StoreSummary[] {
  const grouped = new Map<string, ProductComparison[]>();

  comparisons.forEach((comparison) => {
    const key = comparison.best.shopName;
    grouped.set(key, [...(grouped.get(key) ?? []), comparison]);
  });

  return Array.from(grouped.entries())
    .map(([shopName, winningItems]) => ({
      shopName,
      winCount: winningItems.length,
      strongWinCount: winningItems.filter((item) => item.confidence === "strong").length,
      averageWinningPrice: winningItems.reduce((total, item) => total + item.best.comparisonPrice, 0) / winningItems.length,
      winningItems,
    }))
    .sort((left, right) => right.strongWinCount - left.strongWinCount || right.winCount - left.winCount || left.averageWinningPrice - right.averageWinningPrice);
}

function buildSingleProductComparison(
  normalizedItemName: string,
  rows: ReceiptItemObservation[],
): ProductComparison | null {
  const unitGroups = new Map<string, ReceiptItemObservation[]>();
  const totalGroups = new Map<string, ReceiptItemObservation[]>();

  rows.forEach((row) => {
    const shopName = normalizeShopLabel(row.shopName);
    if (!shopName) {
      return;
    }

    totalGroups.set(shopName, [...(totalGroups.get(shopName) ?? []), row]);

    if (row.unitPrice && row.quantityUnit) {
      const unitKey = `${shopName}::${row.quantityUnit}`;
      unitGroups.set(unitKey, [...(unitGroups.get(unitKey) ?? []), row]);
    }
  });

  const preferredUnit = choosePreferredUnit(rows);
  const comparableUnitGroups = preferredUnit
    ? Array.from(unitGroups.entries())
        .filter(([key]) => key.endsWith(`::${preferredUnit}`))
        .map(([, group]) => group)
    : [];

  const useUnitComparison = comparableUnitGroups.length >= 2;
  const groupedByShop = useUnitComparison
    ? comparableUnitGroups
    : Array.from(totalGroups.values());

  if (groupedByShop.length < 2) {
    return null;
  }

  const comparisonBasis: ComparisonBasis = useUnitComparison ? "unit" : "total";
  const shopInsights = groupedByShop
    .map((group) => buildShopInsight(normalizedItemName, group, comparisonBasis))
    .filter((insight): insight is ShopProductInsight => Boolean(insight))
    .sort((left, right) => left.comparisonPrice - right.comparisonPrice || right.sampleCount - left.sampleCount);

  if (shopInsights.length < 2) {
    return null;
  }

  const best = shopInsights[0];
  const runnerUp = shopInsights[1];
  const confidence: ComparisonConfidence =
    comparisonBasis === "unit" && best.sampleCount >= 2 && runnerUp.sampleCount >= 1 ? "strong" : "reference";

  return {
    itemLabel: best.itemLabel,
    normalizedItemName,
    comparisonBasis,
    confidence,
    shops: shopInsights,
    best: { ...best, confidence },
    runnerUp: { ...runnerUp, confidence: runnerUp.confidence },
    priceGap: Math.max(0, runnerUp.comparisonPrice - best.comparisonPrice),
  };
}

function buildShopInsight(
  normalizedItemName: string,
  rows: ReceiptItemObservation[],
  comparisonBasis: ComparisonBasis,
): ShopProductInsight | null {
  const sortedByDate = rows.slice().sort((left, right) => right.expenseDate.localeCompare(left.expenseDate));
  const latest = sortedByDate[0];
  const comparisonValues = rows
    .map((row) => (comparisonBasis === "unit" ? row.unitPrice : row.totalPrice))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (comparisonValues.length === 0) {
    return null;
  }

  const quantityUnit = comparisonBasis === "unit" ? latest.quantityUnit : undefined;
  const totalPrices = rows.map((row) => row.totalPrice).sort((left, right) => left - right);
  const unitPrices = rows
    .map((row) => row.unitPrice)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);

  return {
    shopId: latest.shopId,
    shopName: normalizeShopLabel(latest.shopName),
    itemLabel: latest.itemName,
    normalizedItemName,
    comparisonBasis,
    comparisonPrice: median(comparisonValues),
    quantityUnit,
    latestDate: latest.expenseDate,
    sampleCount: rows.length,
    confidence: comparisonBasis === "unit" && rows.length >= 2 ? "strong" : "reference",
    totalPriceMedian: median(totalPrices),
    unitPriceMedian: unitPrices.length > 0 ? median(unitPrices) : undefined,
    observations: rows,
  };
}

function choosePreferredUnit(rows: ReceiptItemObservation[]): string | undefined {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.unitPrice || !row.quantityUnit) {
      return;
    }

    counts.set(row.quantityUnit, (counts.get(row.quantityUnit) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
}

function median(values: number[]) {
  const center = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[center];
  }

  return Math.round(((values[center - 1] + values[center]) / 2) * 100) / 100;
}

export function normalizeProductKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s・･]/g, "")
    .replace(/[()（）\[\]【】]/g, "")
    .replace(/[×xX]\d+$/g, "")
    .replace(/\d+(ml|mL|l|L|g|kg|本|個|袋|パック|枚)$/gi, "")
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]/g, "")
    .trim();
}

function normalizeShopLabel(value?: string): string {
  return value?.trim() || "";
}
