import { describe, expect, it } from "vitest";
import { parseExpenseOcrText, parseMedicalOcrText } from "@/utils/ocr";

describe("OCR parsers", () => {
  it("extracts expense receipt candidates", () => {
    const draft = parseExpenseOcrText(`
      イオン岡崎おおたかの杜
      2026/03/15 12:11
      おむつ Mサイズ 58枚 1280
      牛乳 1000ml 198
      合計
      4,580
    `);

    expect(draft.shopName).toBe("イオン岡崎おおたかの杜");
    expect(draft.date).toBe("2026-03-15");
    expect(draft.amount).toBe(4580);
    expect(draft.items[0]?.normalizedItemName).toContain("おむつmサイズ");
    expect(draft.items[0]?.quantity).toBe(58);
    expect(draft.items[0]?.quantityUnit).toBe("枚");
    expect(draft.items[0]?.unitPrice).toBeCloseTo(22.07, 2);
    expect(draft.items[1]?.normalizedItemName).toContain("牛乳");
    expect(draft.items[1]?.quantity).toBe(1000);
    expect(draft.items[1]?.quantityUnit).toBe("ml");
  });

  it("extracts medical receipt candidates", () => {
    const draft = parseMedicalOcrText(`
      おおたかの森こどもクリニック
      2026年3月12日
      診療費
      合計 2,300円
    `);

    expect(draft.hospitalName).toBe("おおたかの森こどもクリニック");
    expect(draft.date).toBe("2026-03-12");
    expect(draft.amount).toBe(2300);
    expect(draft.medicalType).toBe("診療・治療");
  });

  it("extracts medical candidates without overcommitting", () => {
    const draft = parseMedicalOcrText(`
      そうごう薬局
      2026/03/20
      アセトアミノフェン錠 200mg
      調剤基本料
      合計 980円
    `);

    expect(draft.hospitalCandidates[0]?.value).toBe("そうごう薬局");
    expect(draft.medicalTypeCandidates).toContain("医薬品購入");
    expect(draft.medicineCandidates.some((candidate) => candidate.value.includes("アセトアミノフェン"))).toBe(true);
    expect(draft.memoCandidates.some((candidate) => candidate.value.includes("調剤"))).toBe(true);
  });
});
