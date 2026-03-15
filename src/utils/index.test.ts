import { describe, expect, it } from "vitest";
import { generateMedicalCSV } from "@/utils";
import type { MedicalExpense } from "@/types";

describe("generateMedicalCSV", () => {
  it("adds BOM, headers, properly quoted values, and totals", () => {
    const records: MedicalExpense[] = [
      {
        id: "1",
        paymentDate: "2026-03-02",
        amount: 1200,
        reimbursedAmount: 200,
        medicalType: "診療・治療",
        isTransportation: false,
        isChecked: false,
        fiscalYear: 2026,
        memberId: "m1",
        hospitalId: "h1",
        createdAt: new Date("2026-03-02T00:00:00"),
      },
      {
        id: "2",
        paymentDate: "2026-03-03",
        amount: 580,
        reimbursedAmount: 0,
        medicalType: "その他の医療費",
        isTransportation: true,
        isChecked: false,
        fiscalYear: 2026,
        memberId: "m2",
        hospitalId: "h2",
        createdAt: new Date("2026-03-03T00:00:00"),
      },
    ];

    const csv = generateMedicalCSV(
      2026,
      records,
      (id) => (id === "m1" ? "玲美" : "幸平"),
      (id) => (id === "h1" ? "おおたか,クリニック" : "そうごう薬局"),
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);

    const lines = csv.replace("\uFEFF", "").split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      "No,医療を受けた人,病院・薬局などの名称,診療・治療,医薬品購入,介護保険サービス,その他の医療費,支払った医療費の金額,左のうち補填される金額,支払年月日",
    );
    expect(lines[1]).toBe('1,玲美,"おおたか,クリニック",1200,,,,1200,200,2026-03-02');
    expect(lines[2]).toBe("2,幸平,そうごう薬局,,,,580,580,0,2026-03-03");
    expect(lines[3]).toBe(",合計,,,,,,1780,,");
  });
});
