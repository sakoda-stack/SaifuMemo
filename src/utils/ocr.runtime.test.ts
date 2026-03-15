import { beforeEach, describe, expect, it, vi } from "vitest";

describe("OCR runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("falls back to direct recognize when worker creation fails", async () => {
    const recognizeMock = vi.fn().mockResolvedValue({
      data: {
        text: "イオン\n2026/03/15\n合計 4580",
        confidence: 77,
      },
    });

    vi.doMock("tesseract.js", () => ({
      createWorker: vi.fn().mockRejectedValue(new Error("worker boot failed")),
      recognize: recognizeMock,
    }));

    const { recognizeExpenseReceipt } = await import("@/utils/ocr");
    const result = await recognizeExpenseReceipt("data:image/png;base64,AAA");

    expect(recognizeMock).toHaveBeenCalledOnce();
    expect(result.confidence).toBe(77);
    expect(result.draft.amount).toBe(4580);
    expect(result.draft.date).toBe("2026-03-15");
  });

  it("uses configured worker paths when the worker is available", async () => {
    const workerRecognizeMock = vi.fn().mockResolvedValue({
      data: {
        text: "こどもクリニック\n2026年3月12日\n診療費\n合計 2300円",
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
    expect(result.confidence).toBe(88);
    expect(result.draft.amount).toBe(2300);
  });
});
