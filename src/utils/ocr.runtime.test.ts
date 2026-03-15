import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("OCR runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    globalThis.__APP_GEMINI_API_KEY__ = undefined;
  });

  afterEach(() => {
    delete globalThis.__APP_GEMINI_API_KEY__;
  });

  it("uses Gemini OCR when an API key is configured", async () => {
    globalThis.__APP_GEMINI_API_KEY__ = "test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    amount: 4580,
                    date: "2026-03-15",
                    shopName: "テストスーパー",
                    memo: "weekly run",
                    items: [
                      {
                        itemName: "おむつ 54枚",
                        quantity: 54,
                        quantityUnit: "枚",
                        totalPrice: 1680,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("tesseract.js", () => ({
      PSM: { SPARSE_TEXT: "11" },
      createWorker: vi.fn(),
      recognize: vi.fn(),
    }));

    const { recognizeExpenseReceipt } = await import("@/utils/ocr");
    const result = await recognizeExpenseReceipt("data:image/png;base64,AAA");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.engine).toBe("gemini");
    expect(result.confidence).toBeNull();
    expect(result.draft.amount).toBe(4580);
    expect(result.draft.date).toBe("2026-03-15");
    expect(result.draft.shopName).toBe("テストスーパー");
    expect(result.draft.items[0]?.normalizedItemName).toContain("おむつ");
  });

  it("falls back to direct recognize when Gemini and worker init fail", async () => {
    globalThis.__APP_GEMINI_API_KEY__ = "test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "unavailable",
      text: async () => "temporary outage",
    });
    const recognizeMock = vi.fn().mockResolvedValue({
      data: {
        text: "イオン\n2026/03/15\n合計 4580",
        confidence: 77,
      },
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("tesseract.js", () => ({
      createWorker: vi.fn().mockRejectedValue(new Error("worker boot failed")),
      recognize: recognizeMock,
    }));

    const { recognizeExpenseReceipt } = await import("@/utils/ocr");
    const result = await recognizeExpenseReceipt("data:image/png;base64,AAA");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(recognizeMock).toHaveBeenCalledOnce();
    expect(result.engine).toBe("tesseract");
    expect(result.confidence).toBe(77);
    expect(result.draft.amount).toBe(4580);
    expect(result.draft.date).toBe("2026-03-15");
  });

  it("uses configured worker paths when Tesseract worker is available", async () => {
    const workerRecognizeMock = vi.fn().mockResolvedValue({
      data: {
        text: "○○クリニック\n2026年3月12日\n診療費\n合計 2300円",
        confidence: 88,
      },
    });
    const setParametersMock = vi.fn().mockResolvedValue(undefined);
    const createWorkerMock = vi.fn().mockResolvedValue({
      setParameters: setParametersMock,
      recognize: workerRecognizeMock,
    });

    vi.doMock("tesseract.js", () => ({
      PSM: { SPARSE_TEXT: "11" },
      createWorker: createWorkerMock,
      recognize: vi.fn(),
    }));

    const { recognizeMedicalReceipt } = await import("@/utils/ocr");
    const result = await recognizeMedicalReceipt("data:image/png;base64,AAA");

    expect(createWorkerMock).toHaveBeenCalledOnce();
    const [, , options] = createWorkerMock.mock.calls[0];
    expect(options.workerPath).toContain("worker.min.js");
    expect(options.corePath).toContain("tesseract.js-core");
    expect(options.langPath).toContain("tessdata.projectnaptha.com");
    expect(setParametersMock).toHaveBeenCalledOnce();
    expect(workerRecognizeMock).toHaveBeenCalledOnce();
    expect(result.engine).toBe("tesseract");
    expect(result.confidence).toBe(88);
    expect(result.draft.amount).toBe(2300);
  });
});
