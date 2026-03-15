import { useEffect, useState, type ReactNode } from "react";
import { v4 as uuid } from "uuid";
import { db } from "@/db/database";
import { SectionHeader, StickyActionBar } from "@/components/ui/PlannerUI";
import { MEDICAL_TYPES, normalizeDateInput, todayString } from "@/utils";
import type { Member, ShopMaster } from "@/types";

interface Props {
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddMedicalModal({ initialDate, onClose, onSaved }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [hospitals, setHospitals] = useState<ShopMaster[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [medicalType, setMedicalType] = useState(MEDICAL_TYPES[0]);
  const [isTransportation, setIsTransportation] = useState(false);
  const [amount, setAmount] = useState("");
  const [reimbursedAmount, setReimbursedAmount] = useState("");
  const [date, setDate] = useState(normalizeDateInput(initialDate, todayString()));
  const [memo, setMemo] = useState("");
  const [newHospitalName, setNewHospitalName] = useState("");
  const [showNewHospital, setShowNewHospital] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [memberRows, hospitalRows] = await Promise.all([
        db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
        db.shopMasters.toArray().then((rows) => rows.filter((row) => row.isActive && row.shopType !== "general").sort((left, right) => right.usageCount - left.usageCount)),
      ]);
      setMembers(memberRows);
      setHospitals(hospitalRows);
    };

    void load();
  }, []);

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

  return (
    <div className="planner-modal">
      <div className="planner-modal-backdrop" onClick={onClose} />
      <div className="planner-modal-sheet">
        <div className="planner-modal-scroll">
          <div className="planner-page">
            <section className="planner-card">
              <SectionHeader kicker="MEDICAL" title="医療費を追加" />
              <div className="mt-4 space-y-4">
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

                <div className="grid gap-3">
                  <Field label="支払日">
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="planner-field" />
                  </Field>
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
                      新規
                    </button>
                  </div>
                  {showNewHospital ? (
                    <div className="mt-3 grid gap-2">
                      <input value={newHospitalName} onChange={(event) => setNewHospitalName(event.target.value)} className="planner-field" placeholder="病院 / 薬局名" />
                      <button type="button" onClick={addHospital} className="planner-primary-inline planner-primary-inline-medical">
                        追加
                      </button>
                    </div>
                  ) : null}
                </Field>

                <Field label="区分">
                  <div className="grid gap-2">
                    <button type="button" onClick={() => setIsTransportation((current) => !current)} className={`planner-inline-toggle ${isTransportation ? "planner-inline-toggle-active" : ""}`}>
                      通院交通費
                    </button>
                    {!isTransportation ? (
                      <div className="planner-pill-grid">
                        {MEDICAL_TYPES.map((type) => (
                          <button key={type} type="button" onClick={() => setMedicalType(type)} className={`planner-pill ${medicalType === type ? "planner-pill-active" : ""}`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Field>

                <Field label="メモ">
                  <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="planner-field min-h-[104px] resize-none" placeholder="任意" />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <StickyActionBar primaryLabel="保存する" primaryTone="medical" onPrimary={save} secondaryLabel="閉じる" onSecondary={onClose} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="planner-label">{label}</span>
      {children}
    </label>
  );
}
