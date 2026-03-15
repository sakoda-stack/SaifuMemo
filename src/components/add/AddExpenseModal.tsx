import { useEffect, useState, type ReactNode } from "react";
import { v4 as uuid } from "uuid";
import { db } from "@/db/database";
import { SectionHeader, StickyActionBar } from "@/components/ui/PlannerUI";
import { normalizeDateInput, todayString } from "@/utils";
import { resolveIcon } from "@/utils/icons";
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
  const [date, setDate] = useState(normalizeDateInput(initialDate, todayString()));
  const [memo, setMemo] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [showNewShop, setShowNewShop] = useState(false);
  const memberOptions = [{ id: "all", shortName: "全員" }, ...members];

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

    const shopName = shops.find((shop) => shop.id === shopId)?.name ?? (newShopName.trim() || undefined);
    await db.expenses.add({
      id: uuid(),
      date,
      amount: Math.round(parsedAmount),
      memo: memo.trim(),
      isChecked: false,
      isFixed: false,
      productName: "",
      memberId: selectedMember === "all" ? undefined : selectedMember || undefined,
      categoryId: selectedCategory || undefined,
      shopId,
      shopName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (shopId) {
      await db.shopMasters.where("id").equals(shopId).modify((shop) => {
        shop.usageCount += 1;
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
              <SectionHeader kicker="EXPENSE" title="支出を追加" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-3">
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

                <Field label="対象者">
                  <div className="planner-pill-grid">
                    {memberOptions.map((member) => (
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
                      新規
                    </button>
                  </div>
                  {showNewShop ? (
                    <div className="mt-3 grid gap-2">
                      <input value={newShopName} onChange={(event) => setNewShopName(event.target.value)} className="planner-field" placeholder="店舗名" />
                      <button type="button" onClick={addShop} className="planner-primary-inline planner-primary-inline-accent">
                        追加
                      </button>
                    </div>
                  ) : null}
                </Field>

                <Field label="メモ">
                  <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="planner-field min-h-[104px] resize-none" placeholder="任意" />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <StickyActionBar primaryLabel="保存する" onPrimary={save} secondaryLabel="閉じる" onSecondary={onClose} />
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
