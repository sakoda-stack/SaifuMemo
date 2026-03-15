import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Camera, CheckCheck, Download, HeartPulse, Image, Plus, ScanText } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db } from "@/db/database";
import { ActionCard, DataBadge, EmptyState, ScreenIntro, SectionHeader, SegmentedControl, StickyActionBar } from "@/components/ui/PlannerUI";
import { fileToBase64, formatYen, MEDICAL_TYPES, normalizeDateInput, todayString } from "@/utils";
import { downloadDataUrl, recognizeMedicalReceipt, type MedicalOcrDraft, type OcrEngine } from "@/utils/ocr";
import type { MedicalType, Member, ShopMaster } from "@/types";

interface Props {
  initialDate?: string;
  initialMode?: "manual" | "receipt";
  onClose: () => void;
  onSaved: () => void;
}

export default function AddMedicalModal({ initialDate, initialMode = "manual", onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"manual" | "receipt">(initialMode);
  const [members, setMembers] = useState<Member[]>([]);
  const [hospitals, setHospitals] = useState<ShopMaster[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [medicalType, setMedicalType] = useState<MedicalType>("診療・治療");
  const [isTransportation, setIsTransportation] = useState(false);
  const [amount, setAmount] = useState("");
  const [reimbursedAmount, setReimbursedAmount] = useState("");
  const [date, setDate] = useState(normalizeDateInput(initialDate, todayString()));
  const [memo, setMemo] = useState("");
  const [imageData, setImageData] = useState("");
  const [ocrReview, setOcrReview] = useState<MedicalOcrDraft | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrEngine, setOcrEngine] = useState<OcrEngine | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [newHospitalName, setNewHospitalName] = useState("");
  const [showNewHospital, setShowNewHospital] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [memberRows, shopRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.shopMasters.toArray().then((rows) =>
          rows
            .filter((row) => row.isActive && (row.shopType === "hospital" || row.shopType === "pharmacy"))
            .sort((left, right) => right.usageCount - left.usageCount),
        ),
      ]);

      setMembers(memberRows);
      setHospitals(shopRows);
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
      const result = await recognizeMedicalReceipt(base64);
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
    if (ocrReview.hospitalName) {
      const matched = findMatchingHospital(hospitals, ocrReview.hospitalName);
      if (matched) {
        setSelectedHospital(matched.id);
      } else {
        setShowNewHospital(true);
        setNewHospitalName(ocrReview.hospitalName);
      }
    }
    if (ocrReview.medicalType) {
      setIsTransportation(ocrReview.medicalType === "通院交通費");
      if (ocrReview.medicalType !== "通院交通費") {
        setMedicalType(ocrReview.medicalType);
      }
    }
    if (!memo) {
      setMemo(
        [...ocrReview.medicineCandidates.map((candidate) => candidate.value), ...ocrReview.memoCandidates.map((candidate) => candidate.value)]
          .slice(0, 3)
          .join(" / "),
      );
    }
  };

  const addHospital = async () => {
    const name = newHospitalName.trim();
    if (!name) return;

    const hospital: ShopMaster = {
      id: uuid(),
      name,
      shopType: "hospital",
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    };

    await db.shopMasters.add(hospital);
    setHospitals((rows) => [hospital, ...rows]);
    setSelectedHospital(hospital.id);
    setNewHospitalName("");
    setShowNewHospital(false);
  };

  const save = async () => {
    const parsedAmount = Number(amount);
    if (!selectedMember) {
      window.alert("対象者を選択してください。");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      window.alert("金額を入力してください。");
      return;
    }

    let hospitalId = selectedHospital || undefined;
    if (!hospitalId && newHospitalName.trim()) {
      const hospital: ShopMaster = {
        id: uuid(),
        name: newHospitalName.trim(),
        shopType: "hospital",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };
      await db.shopMasters.add(hospital);
      setHospitals((rows) => [hospital, ...rows]);
      hospitalId = hospital.id;
    }

    const hospitalName = hospitals.find((hospital) => hospital.id === hospitalId)?.name ?? (newHospitalName.trim() || undefined);
    await db.medicalExpenses.add({
      id: uuid(),
      paymentDate: date,
      amount: Math.round(parsedAmount),
      reimbursedAmount: Math.max(0, Math.round(Number(reimbursedAmount) || 0)),
      medicalType: isTransportation ? "通院交通費" : medicalType,
      isTransportation,
      isChecked: false,
      fiscalYear: parseInt(date.slice(0, 4), 10),
      receiptImageData: imageData || undefined,
      memberId: selectedMember,
      hospitalId,
      hospitalName,
      memo: memo.trim() || undefined,
      createdAt: new Date(),
    });

    if (hospitalId) {
      await db.shopMasters.where("id").equals(hospitalId).modify((hospital) => {
        hospital.usageCount += 1;
      });
    }

    onSaved();
  };

  const canSave = Boolean(selectedMember) && Number(amount) > 0;

  return (
    <div className="planner-modal">
      <div className="planner-modal-backdrop" onClick={onClose} />
      <div className="planner-modal-sheet">
        <div className="planner-modal-scroll">
          <div className="planner-page">
            <ScreenIntro
              kicker="MEDICAL"
              title="医療費を追加"
              description="手入力とレシート入力を分け、病院名や医療区分は候補として確認できるようにします。"
            />

            <section className="planner-card">
              <SegmentedControl
                value={mode}
                onChange={setMode}
                options={[
                  { value: "manual", label: "手入力" },
                  { value: "receipt", label: "レシート入力" },
                ]}
              />
            </section>

            {mode === "receipt" ? (
              <>
                <section className="planner-card">
                  <SectionHeader kicker="STEP 1" title="画像を読み込む" description="病院・薬局のレシートを撮影または選択します。" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ActionCard title="撮影する" description="カメラで取り込む" icon={<Camera size={18} />} tone="medical" onClick={() => cameraRef.current?.click()} />
                    <ActionCard title="画像を選ぶ" description="端末の写真から取り込む" icon={<Image size={18} />} tone="soft" onClick={() => fileRef.current?.click()} />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && void handleImage(event.target.files[0])} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && void handleImage(event.target.files[0])} />
                </section>

                <section className="planner-card">
                  <SectionHeader
                    kicker="STEP 2"
                    title="候補を確認する"
                    description={ocrLoading ? "OCR を実行中です。" : ocrEngine === "gemini" ? "Gemini で解析しました。" : ocrConfidence !== null ? `信頼度 ${Math.round(ocrConfidence)}%` : "画像を追加すると候補が出ます。"}
                    action={
                      imageData ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => downloadDataUrl(imageData, `medical-${Date.now()}.png`)} className="planner-icon-button" aria-label="画像を保存">
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
                      <EmptyState title="医療レシート画像を待っています" message="病院名、日付、合計金額、医療区分候補、薬候補を抽出します。" />
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                      <img src={imageData} alt="medical receipt preview" className="planner-preview-image" />
                      <div className="space-y-3">
                        {ocrError ? <p className="text-sm text-[var(--planner-danger)]">{ocrError}</p> : null}
                        {ocrReview ? (
                          <>
                            <div className="planner-note-card">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <LabeledValue label="病院名候補" value={ocrReview.hospitalName || "候補なし"} />
                                <LabeledValue label="支払日" value={ocrReview.date || "候補なし"} />
                                <LabeledValue label="合計金額" value={ocrReview.amount ? formatYen(ocrReview.amount) : "候補なし"} />
                                <LabeledValue label="医療区分" value={ocrReview.medicalType || "候補なし"} />
                              </div>
                              <button type="button" onClick={applyOcrToForm} className="planner-primary-inline planner-primary-inline-medical mt-4 w-full justify-center">
                                <CheckCheck size={16} />
                                フォームへ反映
                              </button>
                            </div>

                            <CandidateSection title="病院名候補">
                              {ocrReview.hospitalCandidates.length === 0 ? (
                                <EmptyState title="候補なし" message="OCR で病院名を断定できませんでした。" />
                              ) : (
                                ocrReview.hospitalCandidates.map((candidate) => (
                                  <button
                                    key={candidate.value}
                                    type="button"
                                    onClick={() => {
                                      const matched = findMatchingHospital(hospitals, candidate.value);
                                      if (matched) {
                                        setSelectedHospital(matched.id);
                                      } else {
                                        setShowNewHospital(true);
                                        setNewHospitalName(candidate.value);
                                      }
                                    }}
                                    className="planner-inline-pill"
                                  >
                                    {candidate.value}
                                  </button>
                                ))
                              )}
                            </CandidateSection>

                            <CandidateSection title="医療区分候補">
                              {ocrReview.medicalTypeCandidates.map((candidate) => (
                                <button
                                  key={candidate}
                                  type="button"
                                  onClick={() => {
                                    setIsTransportation(candidate === "通院交通費");
                                    if (candidate !== "通院交通費") {
                                      setMedicalType(candidate);
                                    }
                                  }}
                                  className="planner-inline-pill"
                                >
                                  {candidate}
                                </button>
                              ))}
                            </CandidateSection>

                            <CandidateSection title="薬・処方候補">
                              {ocrReview.medicineCandidates.length === 0 ? (
                                <EmptyState title="候補なし" message="薬局レシートでないか、薬名を読み取れませんでした。" />
                              ) : (
                                ocrReview.medicineCandidates.map((candidate) => (
                                  <button key={candidate.value} type="button" onClick={() => appendMemo(candidate.value, setMemo)} className="planner-inline-pill">
                                    {candidate.value}
                                  </button>
                                ))
                              )}
                            </CandidateSection>

                            <CandidateSection title="メモ候補">
                              {ocrReview.memoCandidates.map((candidate) => (
                                <button key={candidate.value} type="button" onClick={() => appendMemo(candidate.value, setMemo)} className="planner-inline-pill">
                                  {candidate.value}
                                </button>
                              ))}
                            </CandidateSection>
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
              <SectionHeader kicker={mode === "receipt" ? "STEP 3" : "FORM"} title="保存する内容" description="候補を確認したあとに、確定した情報だけ保存します。" />
              <div className="mt-4 space-y-4">
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
                  <Field label="支払日">
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="planner-field" />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="金額">
                    <input type="number" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className="planner-field" placeholder="0" />
                  </Field>
                  <Field label="補填額">
                    <input type="number" inputMode="numeric" value={reimbursedAmount} onChange={(event) => setReimbursedAmount(event.target.value)} className="planner-field" placeholder="0" />
                  </Field>
                </div>

                <Field label="病院 / 薬局">
                  <div className="planner-pill-grid">
                    {hospitals.slice(0, 12).map((hospital) => (
                      <button
                        key={hospital.id}
                        type="button"
                        onClick={() => setSelectedHospital(selectedHospital === hospital.id ? "" : hospital.id)}
                        className={`planner-pill ${selectedHospital === hospital.id ? "planner-pill-active" : ""}`}
                      >
                        {hospital.name}
                      </button>
                    ))}
                    <button type="button" onClick={() => setShowNewHospital((current) => !current)} className="planner-pill">
                      <Plus size={14} />
                      新規
                    </button>
                  </div>
                  {showNewHospital ? (
                    <div className="mt-3 flex gap-2">
                      <input value={newHospitalName} onChange={(event) => setNewHospitalName(event.target.value)} className="planner-field" placeholder="病院 / 薬局名" />
                      <button type="button" onClick={addHospital} className="planner-primary-inline planner-primary-inline-medical">
                        追加
                      </button>
                    </div>
                  ) : null}
                </Field>

                <Field label="医療区分">
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTransportation((current) => !current)}
                      className={`planner-inline-toggle ${isTransportation ? "planner-inline-toggle-active" : ""}`}
                    >
                      通院交通費として扱う
                    </button>
                    {!isTransportation ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {MEDICAL_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setMedicalType(type)}
                            className={`planner-choice-option ${medicalType === type ? "planner-choice-option-active planner-choice-option-medical" : ""}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <DataBadge label="通院交通費" tone="medical" />
                    )}
                  </div>
                </Field>

                <Field label="メモ">
                  <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="planner-field min-h-[88px] resize-none" placeholder="薬候補や診療内容の補足" />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <StickyActionBar
          primaryLabel={mode === "receipt" ? "内容を保存する" : "医療費を保存する"}
          primaryTone="medical"
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

function CandidateSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="planner-note-card">
      <p className="planner-kicker">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
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

function appendMemo(value: string, setMemo: Dispatch<SetStateAction<string>>) {
  setMemo((current) => (current ? `${current} / ${value}` : value));
}

function findMatchingHospital(hospitals: ShopMaster[], candidate: string) {
  const normalized = normalizeMatch(candidate);
  return hospitals.find((hospital) => normalizeMatch(hospital.name) === normalized || normalizeMatch(hospital.name).includes(normalized) || normalized.includes(normalizeMatch(hospital.name)));
}

function normalizeMatch(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}
