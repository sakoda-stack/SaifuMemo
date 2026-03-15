import { describe, expect, it } from "vitest";
import { buildProductComparisons, buildStoreSummaries, normalizeProductKey } from "@/utils/compare";
import type { ReceiptItemObservation } from "@/types";

const rows: ReceiptItemObservation[] = [
  {
    id: "1",
    expenseId: "e1",
    expenseDate: "2026-03-01",
    itemName: "牛乳 1000ml",
    normalizedItemName: "牛乳1000ml",
    shopId: "s1",
    shopName: "イオン",
    totalPrice: 198,
    quantity: 1000,
    quantityUnit: "ml",
    unitPrice: 0.198,
    sourceText: "牛乳 1000ml 198",
    createdAt: new Date("2026-03-01T00:00:00"),
  },
  {
    id: "2",
    expenseId: "e2",
    expenseDate: "2026-03-05",
    itemName: "牛乳 1000ml",
    normalizedItemName: "牛乳1000ml",
    shopId: "s2",
    shopName: "業務スーパー",
    totalPrice: 178,
    quantity: 1000,
    quantityUnit: "ml",
    unitPrice: 0.178,
    sourceText: "牛乳 1000ml 178",
    createdAt: new Date("2026-03-05T00:00:00"),
  },
  {
    id: "3",
    expenseId: "e3",
    expenseDate: "2026-03-07",
    itemName: "卵 10個",
    normalizedItemName: "卵10個",
    shopId: "s1",
    shopName: "イオン",
    totalPrice: 238,
    quantity: 10,
    quantityUnit: "個",
    unitPrice: 23.8,
    sourceText: "卵 10個 238",
    createdAt: new Date("2026-03-07T00:00:00"),
  },
  {
    id: "4",
    expenseId: "e4",
    expenseDate: "2026-03-08",
    itemName: "卵 10個",
    normalizedItemName: "卵10個",
    shopId: "s2",
    shopName: "業務スーパー",
    totalPrice: 218,
    quantity: 10,
    quantityUnit: "個",
    unitPrice: 21.8,
    sourceText: "卵 10個 218",
    createdAt: new Date("2026-03-08T00:00:00"),
  },
];

describe("compare helpers", () => {
  it("normalizes product keys for cross-store matching", () => {
    expect(normalizeProductKey("牛乳 1000ml")).toBe("牛乳");
    expect(normalizeProductKey("たまご(10個)")).toBe("たまご");
  });

  it("builds product comparisons prioritizing unit prices", () => {
    const comparisons = buildProductComparisons(rows);
    const milk = comparisons.find((item) => item.itemLabel.includes("牛乳"));

    expect(comparisons).toHaveLength(2);
    expect(milk?.comparisonBasis).toBe("unit");
    expect(milk?.best.shopName).toBe("業務スーパー");
    expect(milk?.runnerUp?.shopName).toBe("イオン");
    expect(milk?.priceGap).toBeCloseTo(0.02, 2);
  });

  it("summarizes which store wins more products", () => {
    const summaries = buildStoreSummaries(buildProductComparisons(rows));

    expect(summaries[0]?.shopName).toBe("業務スーパー");
    expect(summaries[0]?.winCount).toBe(2);
  });
});
