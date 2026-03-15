import { useEffect, useRef, useState } from "react";
import { Camera, HeartPulse, Image } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db } from "@/db/database";
import { todayString, fileToBase64, MEDICAL_TYPES } from "@/utils";
import type { MedicalType, Member, ShopMaster } from "@/types";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddMedicalModal({ onClose, onSaved }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [hospitals, setHospitals] = useState<ShopMaster[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [medicalType, setMedicalType] = useState<MedicalType>("診療・治療");
  const [isTransportation, setIsTransportation] = useState(false);
  const [amount, setAmount] = useState("");
  const [reimbursedAmount, setReimbursedAmount] = useState("");
  const [date, setDate] = useState(todayString());
  const [imageData, setImageData] = useState("");
  const [newHospital, setNewHospital] = useState("");
  const [showNewHospital, setShowNewHospital] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [memberRows, shopRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((member) => member.isActive)),
        db.shopMasters.toArray().then((rows) =>
          rows
            .filter((shop) => shop.isActive && (shop.shopType === "hospital" || shop.shopType === "pharmacy"))
            .sort((left, right) => right.usageCount - left.usageCount),
        ),
      ]);

      setMembers(memberRows);
      setHospitals(shopRows);
    };

    load();
  }, []);

  const addHospital = async () => {
    if (!newHospital.trim()) return;

    const hospital: ShopMaster = {
      id: uuid(),
      name: newHospital.trim(),
      shopType: "hospital",
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    };

    await db.shopMasters.add(hospital);
    setHospitals((rows) => [hospital, ...rows]);
    setSelectedHospital(hospital.id);
    setNewHospital("");
    setShowNewHospital(false);
  };

  const save = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!selectedMember) {
      alert("医療を受けた人を選択してください");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      alert("金額を入力してください");
      return;
    }

    const hospitalName = hospitals.find((hospital) => hospital.id === selectedHospital)?.name;
    await db.medicalExpenses.add({
      id: uuid(),
      paymentDate: date,
      amount: parsedAmount,
      reimbursedAmount: parseInt(reimbursedAmount, 10) || 0,
      medicalType: isTransportation ? "通院交通費" : medicalType,
      isTransportation,
      isChecked: false,
      fiscalYear: parseInt(date.slice(0, 4), 10),
      receiptImageData: imageData || undefined,
      memberId: selectedMember || undefined,
      hospitalId: selectedHospital || undefined,
      hospitalName,
      createdAt: new Date(),
    });

    if (selectedHospital) {
      await db.shopMasters.where("id").equals(selectedHospital).modify((hospital) => {
        hospital.usageCount += 1;
      });
    }

    onSaved();
  };

  const canSave = !!selectedMember && parseInt(amount, 10) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-3 mb-3 flex max-h-[92vh] w-[calc(100%-24px)] flex-col overflow-hidden rounded-[32px] border border-[var(--planner-line)] bg-[var(--planner-paper)] shadow-[0_20px_60px_rgba(78,64,52,0.18)]">
        <div className="flex items-center justify-between border-b border-[var(--planner-line)] px-5 py-4">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--planner-subtle)]">
            キャンセル
          </button>
          <h2 className="planner-subheading text-base">医療費を追加</h2>
          <button type="button" onClick={save} disabled={!canSave} className="text-sm font-bold" style={{ color: canSave ? "var(--planner-danger)" : "var(--planner-line)" }}>
            保存
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section className="planner-form-panel bg-[rgba(212,106,106,0.08)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[rgba(212,106,106,0.16)]">
                  <HeartPulse size={18} className="text-[var(--planner-danger)]" />
                </div>
                <p className="text-sm text-[var(--planner-text)]">医療費控除に使う前提で、病院代・薬代・通院交通費をまとめられます。</p>
              </div>
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">レシート画像</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => cameraRef.current?.click()} className="planner-action bg-[rgba(212,106,106,0.12)] text-[var(--planner-danger)]">
                  <Camera size={16} className="mr-2" />
                  撮影
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="planner-action bg-[rgba(212,106,106,0.12)] text-[var(--planner-danger)]">
                  <Image size={16} className="mr-2" />
                  ライブラリ
                </button>
                <div className="planner-action bg-[var(--planner-soft)] text-[var(--planner-subtle)]">{imageData ? "添付済み" : "任意"}</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && fileToBase64(event.target.files[0]).then(setImageData)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && fileToBase64(event.target.files[0]).then(setImageData)} />
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">支払った金額</label>
              <div className="flex items-center rounded-[20px] border border-[var(--planner-line)] bg-white px-4">
                <span className="mr-3 text-2xl font-bold text-[var(--planner-subtle)]">¥</span>
                <input
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
              <label className="planner-label">医療を受けた人</label>
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
              <label className="planner-label">病院・薬局</label>
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
                  ＋ 病院追加
                </button>
              </div>
              {showNewHospital && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={newHospital}
                    onChange={(event) => setNewHospital(event.target.value)}
                    placeholder="病院名・薬局名"
                    className="planner-field flex-1"
                  />
                  <button type="button" onClick={addHospital} className="planner-action bg-[var(--planner-danger)] text-white">
                    追加
                  </button>
                </div>
              )}
            </section>

            <section className="planner-form-panel">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="planner-label mb-1">通院交通費として登録</label>
                  <p className="text-xs text-[var(--planner-subtle)]">電車・バスなどの交通費を医療費に含めます。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransportation((current) => !current)}
                  className="flex h-8 w-14 items-center rounded-full px-1"
                  style={{ backgroundColor: isTransportation ? "var(--planner-accent)" : "var(--planner-line)" }}
                >
                  <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${isTransportation ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </section>

            {!isTransportation && (
              <section className="planner-form-panel">
                <label className="planner-label">医療費区分</label>
                <div className="space-y-2">
                  {MEDICAL_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMedicalType(type)}
                      className="flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left"
                      style={{
                        borderColor: medicalType === type ? "var(--planner-danger)" : "var(--planner-line)",
                        backgroundColor: medicalType === type ? "rgba(212,106,106,0.08)" : "white",
                      }}
                    >
                      <span className={`h-4 w-4 rounded-full border-2 ${medicalType === type ? "border-[var(--planner-danger)] bg-[var(--planner-danger)]" : "border-[var(--planner-line)]"}`} />
                      <span className="text-sm font-semibold text-[var(--planner-text)]">{type}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="planner-form-panel">
              <label className="planner-label">補填される金額</label>
              <input
                type="number"
                inputMode="numeric"
                value={reimbursedAmount}
                onChange={(event) => setReimbursedAmount(event.target.value)}
                placeholder="0"
                className="planner-field"
              />
              <p className="mt-2 text-xs text-[var(--planner-subtle)]">保険金や高額療養費がある場合だけ入力してください。</p>
            </section>

            <section className="planner-form-panel">
              <label className="planner-label">支払日</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="planner-field" />
            </section>

            <button type="button" onClick={save} disabled={!canSave} className="planner-action w-full border-0 bg-[var(--planner-danger)] text-white disabled:opacity-50">
              この内容で保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
