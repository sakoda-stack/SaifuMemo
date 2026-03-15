import { useEffect, useRef, useState } from "react";
import { Camera, CheckCheck, Download, Image, ScanText } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db, replaceReceiptItemObservations } from "@/db/database";
import { todayString, fileToBase64 } from "@/utils";
import { resolveIcon } from "@/utils/icons";
import { downloadDataUrl, recognizeExpenseReceipt, toObservationPayload, type ExpenseOcrDraft } from "@/utils/ocr";
import type { Category, Member, ShopMaster } from "@/types";

interface Props {
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddExpenseModal({ initialDate, onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<ShopMaster[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(initialDate ?? todayString());
  const [memo, setMemo] = useState("");
  const [imageData, setImageData] = useState("");
  const [ocrDraft, setOcrDraft] = useState<ExpenseOcrDraft | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [newShop, setNewShop] = useState("");
  const [showNewShop, setShowNewShop] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [categoryRows, memberRows, shopRows] = await Promise.all([
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((category) => category.isActive)),
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.shopMasters.toArray().then((rows) =>
          rows.filter((shop) => shop.isActive && shop.shopType === "general").sort((left, right) => right.usageCount - left.usageCount),
        ),
      ]);
      setCategories(categoryRows.filter((category) => !category.isMedical));
      setMembers(memberRows);
      setShops(shopRows);
    };

    load();
    setTimeout(() => amountRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  const handleImage = async (file: File) => {
    const base64 = await fileToBase64(file);
    setImageData(base64);
    void runOcr(base64);
  };

  const runOcr = async (base64: string) => {
    setOcrLoading(true);
    setOcrError("");
    try {
      const result = await recognizeExpenseReceipt(base64);
      setOcrDraft(result.draft);
      setOcrText(result.text);
      setOcrConfidence(result.confidence);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "OCR に失敗しました");
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrDraft = () => {
    if (!ocrDraft) return;

    if (ocrDraft.amount) {
      setAmount(String(ocrDraft.amount));
    }
    if (ocrDraft.date) {
      setDate(ocrDraft.date);
    }
    if (ocrDraft.shopName) {
      const matchedShopId = findMatchingShopId(shops, ocrDraft.shopName);
      if (matchedShopId) {
        setSelectedShop(matchedShopId);
      } else {
        setNewShop(ocrDraft.shopName);
        setShowNewShop(true);
        setMemo((current) => current || ocrDraft.shopName || "");
      }
    }
    if (ocrDraft.memo) {
      setMemo((current) => current || ocrDraft.memo || "");
    }
  };

  const addShop = async () => {
    if (!newShop.trim()) return;

    const id = uuid();
    const shop: ShopMaster = {
      id,
      name: newShop.trim(),
      shopType: "general",
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    };

    await db.shopMasters.add(shop);
    setShops((rows) => [shop, ...rows]);
    setSelectedShop(id);
    setNewShop("");
    setShowNewShop(false);
  };

  const save = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      alert("金額を入力してください");
      return;
    }

    const shopName = shops.find((shop) => shop.id === selectedShop)?.name;
    const expenseId = uuid();
    await db.expenses.add({
      id: expenseId,
      date,
      amount: parsedAmount,
      memo,
      isChecked: false,
      isFixed: false,
      productName: ocrDraft?.items?.[0]?.itemName || "",
      receiptImageData: imageData || undefined,
      memberId: selectedMember || undefined,
      categoryId: selectedCategory || undefined,
      shopId: selectedShop || undefined,
      shopName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (ocrDraft?.items?.length) {
      await replaceReceiptItemObservations(
        expenseId,
        toObservationPayload(ocrDraft, date, shopName, selectedShop || undefined),
      );
    }

    if (selectedShop) {
      await db.shopMasters.where("id").equals(selectedShop).modify((shop) => {
        shop.usageCount += 1;
      });
    }

    onSaved();
  };

  const canSave = parseInt(amount, 10) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-3 mb-3 flex max-h-[92vh] w-[calc(100%-24px)] flex-col overflow-hidden rounded-[32px] border border-[var(--planner-line)] bg-[var(--planner-paper)] shadow-[0_20px_60px_rgba(78,64,52,0.18)]">
        <div className="flex items-center justify-between border-b border-[var(--planner-line)] px-5 py-4">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--planner-subtle)]">
            キャンセル
          </button>
          <h2 className="planner-subheading text-base">支出を追加</h2>
          <button type="button" onClick={save} disabled={!canSave} className="text-sm font-bold" style={{ color: canSave ? "var(--planner-accent)" : "var(--planner-line)" }}>
            保存
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section className="planner-form-panel">
              <label className="planner-label">レシート画像</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => cameraRef.current?.click()} className="planner-action bg-[rgba(106,132,195,0.12)] text-[var(--planner-accent)]">
                  <Camera size={16} className="mr-2" />
                  撮影
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="planner-action bg-[rgba(106,132,195,0.12)] text-[var(--planner-accent)]">
                  <Image size={16} className="mr-2" />
                  ライブラリ
                </button>
                <div className="planner-action bg-[var(--planner-soft)] text-[var(--planner-subtle)]">{imageData ? "添付済み" : "任意"}</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && handleImage(event.target.files[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && handleImage(event.target.files[0])} />
            </section>

            {imageData && (
              <section className="planner-form-panel">
                <div className="planner-section-header">
                  <div>
                    <label className="planner-label mb-1">OCR 読み取り結果</label>
                    <p className="text-xs text-[var(--planner-subtle)]">
                      {ocrLoading ? "読み取り中..." : ocrConfidence !== null ? `信頼度 ${Math.round(ocrConfidence)}%` : "画像のみ保持中"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => downloadDataUrl(imageData, `receipt-${Date.now()}.png`)} className="planner-icon-button" aria-label="写真を保存">
                      <Download size={16} />
                    </button>
                    <button type="button" onClick={() => void runOcr(imageData)} className="planner-icon-button" aria-label="OCR再実行">
                      <ScanText size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <img src={imageData} alt="receipt preview" className="planner-tile h-40 w-full object-cover" />
                  <div className="space-y-3">
                    {ocrError && <p className="text-sm text-[var(--planner-danger)]">{ocrError}</p>}
                    {ocrDraft && (
                      <div className="rounded-[18px_8px_16px_8px] bg-white p-3">
                        <p className="text-sm text-[var(--planner-text)]">金額: {ocrDraft.amount ? `¥${ocrDraft.amount.toLocaleString("ja-JP")}` : "未取得"}</p>
                        <p className="text-sm text-[var(--planner-text)]">日付: {ocrDraft.date ?? "未取得"}</p>
                        <p className="planner-wrap-text text-sm text-[var(--planner-text)]">店舗候補: {ocrDraft.shopName ?? "未取得"}</p>
                        <p className="text-sm text-[var(--planner-text)]">商品候補: {ocrDraft.items.length}件</p>
                        {ocrDraft.items.length > 0 && (
                          <div className="mt-2 rounded-[16px_8px_14px_8px] bg-[var(--planner-soft)] p-2 text-xs text-[var(--planner-subtle)]">
                            {ocrDraft.items.slice(0, 3).map((item) => (
                              <p key={`${item.itemName}-${item.totalPrice}`} className="planner-wrap-text">
                                {item.itemName} {item.unitPrice ? `(${item.unitPrice}/${item.quantityUnit})` : ""} - ¥{item.totalPrice.toLocaleString("ja-JP")}
                              </p>
                            ))}
                          </div>
                        )}
                        <button type="button" onClick={applyOcrDraft} className="planner-action mt-3 w-full bg-[var(--planner-accent)] text-white">
                          <CheckCheck size={16} className="mr-2" />
                          項目へ反映する
                        </button>
                      </div>
                    )}
                    {ocrText && (
                      <details className="rounded-[18px_8px_16px_8px] bg-white p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[var(--planner-subtle)]">読み取った文字を確認</summary>
                        <pre className="planner-wrap-text mt-3 whitespace-pre-wrap text-xs text-[var(--planner-subtle)]">{ocrText}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="planner-form-panel">
              <label className="planner-label">金額</label>
              <div className="flex items-center rounded-[20px] border border-[var(--planner-line)] bg-white px-4">
                <span className="mr-3 text-2xl font-bold text-[var(--planner-subtle)]">¥</span>
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  className="w-full border-0 bg-transparent py-3 text-4xl font-bold text-[var(--planner-text)] outline-none"
                />
              </div>
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">カテゴリ</label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((category) => {
                  const Icon = resolveIcon(category.icon, "ReceiptText");
                  const active = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(active ? "" : category.id)}
                      className="planner-tile border p-3 text-center"
                      style={{
                        borderColor: active ? category.colorHex : "var(--planner-line)",
                        backgroundColor: active ? `${category.colorHex}22` : "white",
                      }}
                    >
                      <div className="mb-2 flex justify-center">
                        <Icon size={18} color={active ? category.colorHex : "#8A7D70"} />
                      </div>
                      <div className="text-[10px] font-semibold text-[var(--planner-text)]">{category.name}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">支払った人</label>
              <div className="planner-pill-grid">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(selectedMember === member.id ? "" : member.id)}
                    className={`planner-pill ${selectedMember === member.id ? "planner-pill-active" : ""}`}
                  >
                    {member.shortName}
                  </button>
                ))}
              </div>
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">店舗</label>
              <div className="planner-pill-grid">
                {shops.slice(0, 12).map((shop) => (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => setSelectedShop(selectedShop === shop.id ? "" : shop.id)}
                    className={`planner-pill ${selectedShop === shop.id ? "planner-pill-active" : ""}`}
                  >
                    {shop.name}
                  </button>
                ))}
                <button type="button" onClick={() => setShowNewShop((current) => !current)} className="planner-pill">
                  ＋ 店舗追加
                </button>
              </div>
              {showNewShop && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={newShop}
                    onChange={(event) => setNewShop(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && addShop()}
                    placeholder="店舗名を入力"
                    className="planner-field flex-1"
                  />
                  <button type="button" onClick={addShop} className="planner-action bg-[var(--planner-accent)] text-white">
                    追加
                  </button>
                </div>
              )}
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">日付</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="planner-field" />
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">メモ</label>
              <textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                rows={3}
                placeholder="例: 週末のまとめ買い"
                className="planner-field resize-none"
              />
            </section>

            <button type="button" onClick={save} disabled={!canSave} className="planner-action w-full border-0 bg-[var(--planner-accent)] text-white disabled:opacity-50">
              この内容で保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function findMatchingShopId(shops: ShopMaster[], candidate: string) {
  const normalizedCandidate = normalizeMatch(candidate);
  return shops.find((shop) => normalizedCandidate.includes(normalizeMatch(shop.name)) || normalizeMatch(shop.name).includes(normalizedCandidate))?.id;
}

function normalizeMatch(value: string) {
  return value.replace(/\s/g, "").replace(/[株式会社有限会社]/g, "");
}
