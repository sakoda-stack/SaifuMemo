import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, CheckCheck, Download, Image, Plus, ScanText } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db, replaceReceiptItemObservations } from "@/db/database";
import { ActionCard, EmptyState, SectionHeader, SegmentedControl, StickyActionBar } from "@/components/ui/PlannerUI";
import { fileToBase64, formatYen, normalizeDateInput, todayString } from "@/utils";
import { downloadDataUrl, recognizeExpenseReceipt, toObservationPayload, type ExpenseOcrDraft, type OcrEngine, type OcrReceiptItem } from "@/utils/ocr";
import { resolveIcon } from "@/utils/icons";
import type { Category, Member, ShopMaster } from "@/types";

interface Props {
  initialDate?: string;
  initialMode?: "manual" | "receipt";
  onClose: () => void;
  onSaved: () => void;
}

export default function AddExpenseModal({ initialDate, initialMode = "manual", onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"manual" | "receipt">(initialMode);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<ShopMaster[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(normalizeDateInput(initialDate, todayString()));
  const [memo, setMemo] = useState("");
  const [imageData, setImageData] = useState("");
  const [ocrReview, setOcrReview] = useState<ExpenseOcrDraft | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrEngine, setOcrEngine] = useState<OcrEngine | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [showNewShop, setShowNewShop] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [categoryRows, memberRows, shopRows] = await Promise.all([
        db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive && !row.isMedical)),
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.shopMasters.toArray().then((rows) => rows.filter((row) => row.isActive && row.shopType === "general").sort((left, right) => right.usageCount - left.usageCount)),
      ]);
      setCategories(categoryRows);
      setMembers(memberRows);
      setShops(shopRows);
    };

    void load();
  }, []);

  useEffect(() => {
    setDate(normalizeDateInput(initialDate, todayString()));
  }, [initialDate]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleImage = async (file: File) => {
    const base64 = await fileToBase64(file);
    setImageData(base64);
    await runOcr(base64);
  };

  const runOcr = async (base64: string) => {
    setOcrLoading(true);
    setOcrError("");
    try {
      const result = await recognizeExpenseReceipt(base64);
      setOcrReview(result.draft);
      setOcrText(result.text);
      setOcrConfidence(result.confidence);
      setOcrEngine(result.engine);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "OCR に失敗しました。");
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrToForm = () => {
    if (!ocrReview) return;

    if (ocrReview.amount) {
      setAmount(String(ocrReview.amount));
    }
    if (ocrReview.date) {
      setDate(ocrReview.date);
    }
    if (ocrReview.memo && !memo) {
      setMemo(ocrReview.memo);
    }
    if (ocrReview.shopName) {
      const matched = findMatchingShop(shops, ocrReview.shopName);
      if (matched) {
        setSelectedShop(matched.id);
      } else {
        setShowNewShop(true);
        setNewShopName(ocrReview.shopName);
      }
    }
  };

  const updateReviewItem = (index: number, key: keyof OcrReceiptItem, value: string) => {
    setOcrReview((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (key === "itemName") {
          return { ...item, itemName: value, normalizedItemName: value.replace(/\s+/g, "").toLowerCase() };
        }
        if (key === "quantityUnit") {
          return { ...item, quantityUnit: value || undefined };
        }

        const parsedNumber = value ? Number(value) : undefined;
        if (key === "quantity") {
          return { ...item, quantity: parsedNumber };
        }
        if (key === "totalPrice") {
          return { ...item, totalPrice: parsedNumber ? Math.round(parsedNumber) : 0 };
        }
        if (key === "unitPrice") {
          return { ...item, unitPrice: parsedNumber };
        }

        return item;
      });

      return { ...current, items: nextItems };
    });
  };

  const removeReviewItem = (index: number) => {
    setOcrReview((current) => (current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current));
  };

  const addShop = async () => {
    const name = newShopName.trim();
    if (!name) return;

    const shop: ShopMaster = {
      id: uuid(),
      name,
      shopType: "general",
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    };

    await db.shopMasters.add(shop);
    setShops((rows) => [shop, ...rows]);
    setSelectedShop(shop.id);
    setNewShopName("");
    setShowNewShop(false);
  };

  const save = async () => {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      window.alert("金額を入力してください。");
      return;
    }

    const shopName = shops.find((shop) => shop.id === selectedShop)?.name ?? (newShopName.trim() || undefined);
    let shopId = selectedShop || undefined;

    if (!shopId && newShopName.trim()) {
      const shop: ShopMaster = {
        id: uuid(),
        name: newShopName.trim(),
        shopType: "general",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };
      await db.shopMasters.add(shop);
      setShops((rows) => [shop, ...rows]);
      shopId = shop.id;
    }

    const expenseId = uuid();
    await db.expenses.add({
      id: expenseId,
      date,
      amount: Math.round(parsedAmount),
      memo,
      isChecked: false,
      isFixed: false,
      productName: ocrReview?.items[0]?.itemName || "",
      receiptImageData: imageData || undefined,
      memberId: selectedMember || undefined,
      categoryId: selectedCategory || undefined,
      shopId,
      shopName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (ocrReview?.items.length) {
      await replaceReceiptItemObservations(expenseId, toObservationPayload(ocrReview, date, shopName, shopId));
    }

    if (shopId) {
      await db.shopMasters.where("id").equals(shopId).modify((shop) => {
        shop.usageCount += 1;
      });
    }

    onSaved();
  };

  const canSave = Number(amount) > 0 && Boolean(date);

  return (
    <div className="planner-modal">
      <div className="planner-modal-backdrop" onClick={onClose} />
      <div className="planner-modal-sheet">
        <div className="planner-modal-scroll">
          <div className="planner-page">
            <section className="planner-card">
              <SectionHeader
                kicker="EXPENSE"
                title="支出を追加"
                description="手入力とレシート入力を切り替え、必要な項目だけを短く埋めます。"
              />
              <div className="mt-3">
                <SegmentedControl
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "manual", label: "手入力" },
                    { value: "receipt", label: "レシート入力" },
                  ]}
                />
              </div>
            </section>

            {mode === "receipt" ? (
              <>
                <section className="planner-card">
                  <SectionHeader kicker="STEP 1" title="画像を読み込む" description="撮影または画像選択で OCR を開始します。" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ActionCard title="撮影する" description="カメラでレシートを取り込む" icon={<Camera size={18} />} tone="accent" onClick={() => cameraRef.current?.click()} />
                    <ActionCard title="画像を選ぶ" description="端末の写真から読み込む" icon={<Image size={18} />} tone="soft" onClick={() => fileRef.current?.click()} />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && void handleImage(event.target.files[0])} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && void handleImage(event.target.files[0])} />
                </section>

                <section className="planner-card">
                  <SectionHeader
                    kicker="STEP 2"
                    title="OCR 結果を確認"
                    description={ocrLoading ? "OCR を実行中です。" : ocrEngine === "gemini" ? "Gemini で解析しました。" : ocrConfidence !== null ? `信頼度 ${Math.round(ocrConfidence)}%` : "画像を追加すると解析結果が出ます。"}
                    action={
                      imageData ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => downloadDataUrl(imageData, `receipt-${Date.now()}.png`)} className="planner-icon-button" aria-label="画像を保存">
                            <Download size={16} />
                          </button>
                          <button type="button" onClick={() => void runOcr(imageData)} className="planner-icon-button" aria-label="OCR 再実行">
                            <ScanText size={16} />
                          </button>
                        </div>
                      ) : null
                    }
                  />

                  {!imageData ? (
                    <div className="mt-4">
                      <EmptyState title="レシート画像を待っています" message="画像を追加すると、店舗名、日付、合計金額、商品行をフォームで確認できます。" />
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                      <img src={imageData} alt="receipt preview" className="planner-preview-image" />
                      <div className="space-y-3">
                        {ocrError ? <p className="text-sm text-[var(--planner-danger)]">{ocrError}</p> : null}
                        {ocrReview ? (
                          <>
                            <div className="planner-note-card">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <LabeledValue label="店舗名" value={ocrReview.shopName || "候補なし"} />
                                <LabeledValue label="日付" value={ocrReview.date || "候補なし"} />
                                <LabeledValue label="合計金額" value={ocrReview.amount ? formatYen(ocrReview.amount) : "候補なし"} />
                                <LabeledValue label="メモ候補" value={ocrReview.notes[0] || ocrReview.memo || "候補なし"} />
                              </div>
                              <button type="button" onClick={applyOcrToForm} className="planner-primary-inline planner-primary-inline-accent mt-4 w-full justify-center">
                                <CheckCheck size={16} />
                                フォームへ反映
                              </button>
                            </div>

                            <div className="planner-note-card">
                              <p className="planner-kicker">商品一覧</p>
                              <div className="mt-3 space-y-3">
                                {ocrReview.items.length === 0 ? (
                                  <EmptyState title="商品行が見つかりませんでした" message="合計だけ反映して、商品名はあとから追記できます。" />
                                ) : (
                                  ocrReview.items.map((item, index) => (
                                    <div key={`${item.sourceText}-${index}`} className="planner-item-editor">
                                      <input
                                        value={item.itemName}
                                        onChange={(event) => updateReviewItem(index, "itemName", event.target.value)}
                                        className="planner-field"
                                        placeholder="商品名"
                                      />
                                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)]">
                                        <input
                                          value={item.quantity ?? ""}
                                          onChange={(event) => updateReviewItem(index, "quantity", event.target.value)}
                                          className="planner-field"
                                          inputMode="decimal"
                                          placeholder="数量"
                                        />
                                        <input
                                          value={item.quantityUnit ?? ""}
                                          onChange={(event) => updateReviewItem(index, "quantityUnit", event.target.value)}
                                          className="planner-field"
                                          placeholder="単位"
                                        />
                                        <input
                                          value={item.totalPrice}
                                          onChange={(event) => updateReviewItem(index, "totalPrice", event.target.value)}
                                          className="planner-field col-span-2 sm:col-span-1"
                                          inputMode="numeric"
                                          placeholder="金額"
                                        />
                                      </div>
                                      <button type="button" onClick={() => removeReviewItem(index)} className="text-xs font-semibold text-[var(--planner-subtle)]">
                                        この行を削除
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        ) : null}

                        {ocrText ? (
                          <details className="planner-note-card">
                            <summary className="cursor-pointer text-sm font-semibold text-[var(--planner-subtle)]">OCR の生データを表示</summary>
                            <pre className="mt-3 whitespace-pre-wrap text-xs text-[var(--planner-subtle)]">{ocrText}</pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : null}

            <section className="planner-card">
              <SectionHeader kicker={mode === "receipt" ? "STEP 3" : "FORM"} title="保存する内容" description="足りない項目だけ追記して保存します。" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="金額">
                    <input type="number" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className="planner-field" placeholder="0" />
                  </Field>
                  <Field label="日付">
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="planner-field" />
                  </Field>
                </div>

                <Field label="カテゴリ">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {categories.map((category) => {
                      const Icon = resolveIcon(category.icon, "ReceiptText");
                      const active = selectedCategory === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedCategory(active ? "" : category.id)}
                          className="planner-category-chip"
                          style={{
                            borderColor: active ? category.colorHex : "var(--planner-line)",
                            backgroundColor: active ? `${category.colorHex}18` : "var(--planner-paper)",
                            color: active ? category.colorHex : "var(--planner-text)",
                          }}
                        >
                          <Icon size={16} />
                          <span>{category.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="対象者">
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
                  </Field>

                  <Field label="店舗">
                    <div className="planner-pill-grid">
                      {shops.slice(0, 10).map((shop) => (
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
                        <Plus size={14} />
                        新規
                      </button>
                    </div>
                  {showNewShop ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input value={newShopName} onChange={(event) => setNewShopName(event.target.value)} className="planner-field" placeholder="店舗名" />
                      <button type="button" onClick={addShop} className="planner-primary-inline planner-primary-inline-accent">
                        追加
                        </button>
                      </div>
                    ) : null}
                  </Field>
                </div>

                <Field label="メモ">
                  <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="planner-field min-h-[88px] resize-none" placeholder="補足メモ" />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <StickyActionBar
          primaryLabel={mode === "receipt" ? "内容を保存する" : "支出を保存する"}
          primaryTone="accent"
          primaryDisabled={!canSave}
          onPrimary={save}
          secondaryLabel="閉じる"
          onSecondary={onClose}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="planner-label">{label}</label>
      {children}
    </div>
  );
}

function LabeledValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="planner-label mb-1">{label}</p>
      <p className="text-sm text-[var(--planner-text)]">{value}</p>
    </div>
  );
}

function findMatchingShop(shops: ShopMaster[], candidate: string) {
  const normalized = normalizeMatch(candidate);
  return shops.find((shop) => normalizeMatch(shop.name) === normalized || normalizeMatch(shop.name).includes(normalized) || normalized.includes(normalizeMatch(shop.name)));
}

function normalizeMatch(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}
