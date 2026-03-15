import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, generateFixedRecords, getMonthlyFixedRecords, seedIfNeeded } from "@/db/database";

describe("seedIfNeeded", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it("fills all master tables on a fresh database", async () => {
    await seedIfNeeded();

    expect(await db.categories.count()).toBeGreaterThan(5);
    expect(await db.members.count()).toBeGreaterThanOrEqual(4);
    expect(await db.shopMasters.count()).toBeGreaterThanOrEqual(6);
    expect(await db.fixedTemplates.count()).toBeGreaterThanOrEqual(4);
    expect(await db.fixedRecords.count()).toBeGreaterThanOrEqual(4);
  });

  it("backfills missing masters even when categories already exist", async () => {
    await db.categories.add({
      id: "custom-category",
      name: "既存カテゴリ",
      icon: "Star",
      colorHex: "#D5A740",
      sortOrder: 0,
      isMedical: false,
      isFixed: false,
      isCustom: true,
      isActive: true,
    });

    await seedIfNeeded();

    expect(await db.categories.count()).toBe(1);
    expect(await db.members.count()).toBeGreaterThanOrEqual(4);
    expect(await db.shopMasters.count()).toBeGreaterThanOrEqual(6);
    expect(await db.fixedTemplates.count()).toBeGreaterThanOrEqual(4);
  });

  it("does not duplicate monthly fixed records when generation runs twice", async () => {
    await seedIfNeeded();
    const initialCount = await db.fixedRecords.count();

    await generateFixedRecords();
    const nextCount = await db.fixedRecords.count();

    expect(nextCount).toBe(initialCount);
  });

  it("filters out monthly fixed records that no longer have an active template", async () => {
    await seedIfNeeded();
    const today = new Date();
    const templates = await db.fixedTemplates.toArray();
    const template = templates[0];

    await db.fixedTemplates.update(template.id, { isActive: false });
    const visibleRecords = await getMonthlyFixedRecords(today.getFullYear(), today.getMonth() + 1);

    expect(visibleRecords.some((record) => record.templateId === template.id)).toBe(false);
  });
});
