import { describe, expect, it } from "vitest";
import { parseExpenseOcrText, parseMedicalOcrText } from "@/utils/ocr";

describe("OCR parsers", () => {
  it("extracts expense receipt candidates", () => {
    const draft = parseExpenseOcrText(`
      イオン流山おおたかの森
      2026/03/15 12:11
      食品
      合計 ¥4,580
    `);

    expect(draft.shopName).toBe("イオン流山おおたかの森");
    expect(draft.date).toBe("2026-03-15");
    expect(draft.amount).toBe(4580);
  });

  it("extracts medical receipt candidates", () => {
    const draft = parseMedicalOcrText(`
      おおたかの森こどもクリニック
      2026年3月12日
      診療費
      領収金額 2,300円
    `);

    expect(draft.hospitalName).toBe("おおたかの森こどもクリニック");
    expect(draft.date).toBe("2026-03-12");
    expect(draft.amount).toBe(2300);
    expect(draft.medicalType).toBe("診療・治療");
  });
});
