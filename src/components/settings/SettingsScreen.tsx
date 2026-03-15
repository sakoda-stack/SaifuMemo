import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Edit3, Plus, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db, getMonthlyFixedRecords } from "@/db/database";
import { ActionCard, EmptyState, ScreenIntro, SectionHeader } from "@/components/ui/PlannerUI";
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, resolveIcon } from "@/utils/icons";
import { formatYen } from "@/utils";
import type { Category, FixedExpenseRecord, FixedExpenseTemplate, Member, ShopMaster } from "@/types";

type Section = "menu" | "members" | "shops" | "hospitals" | "categories" | "fixed";

export default function SettingsScreen() {
  const [section, setSection] = useState<Section>("menu");

  if (section === "members") {
    return <MembersManager onBack={() => setSection("menu")} />;
  }
  if (section === "shops") {
    return <ShopManager onBack={() => setSection("menu")} mode="general" title="店舗マスタ" />;
  }
  if (section === "hospitals") {
    return <ShopManager onBack={() => setSection("menu")} mode="medical" title="病院・薬局マスタ" />;
  }
  if (section === "categories") {
    return <CategoryManager onBack={() => setSection("menu")} />;
  }
  if (section === "fixed") {
    return <FixedManager onBack={() => setSection("menu")} />;
  }
  return (
    <div className="planner-page">
      <ScreenIntro kicker="SETTINGS" title="管理メニュー" />

      <section className="planner-card">
        <SectionHeader kicker="MASTER" title="マスタ管理" />
        <div className="mt-4 grid gap-3">
          <ActionCard title="家族メンバー" icon={<Plus size={18} />} onClick={() => setSection("members")} />
          <ActionCard title="店舗マスタ" icon={<Plus size={18} />} onClick={() => setSection("shops")} />
          <ActionCard title="病院・薬局マスタ" icon={<Plus size={18} />} onClick={() => setSection("hospitals")} />
          <ActionCard title="カテゴリ" icon={<Edit3 size={18} />} onClick={() => setSection("categories")} />
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="FLOW" title="入力確認" />
        <div className="mt-4 grid gap-3">
          <ActionCard title="固定費テンプレート" icon={<Edit3 size={18} />} onClick={() => setSection("fixed")} />
        </div>
      </section>
    </div>
  );
}

function MembersManager({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");

  const load = async () => {
    setMembers(await db.members.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)));
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setShortName("");
  };

  const save = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await db.members.update(editingId, {
        name: name.trim(),
        shortName: shortName.trim() || name.trim(),
      });
    } else {
      await db.members.add({
        id: uuid(),
        name: name.trim(),
        shortName: shortName.trim() || name.trim(),
        sortOrder: members.length,
        isActive: true,
        createdAt: new Date(),
      });
    }

    reset();
    await load();
  };

  const edit = (member: Member) => {
    setEditingId(member.id);
    setName(member.name);
    setShortName(member.shortName);
  };

  const remove = async (member: Member) => {
    if (!window.confirm(`${member.name} を停止しますか。`)) return;
    await db.members.update(member.id, { isActive: false });
    await load();
  };

  return (
    <SettingsLayout title="家族メンバー" onBack={onBack}>
      <EditPanel
        title={editingId ? "メンバーを編集" : "メンバーを追加"}
        onSave={save}
        onCancel={reset}
        saveLabel={editingId ? "更新" : "追加"}
      >
        <Field label="氏名">
          <input value={name} onChange={(event) => setName(event.target.value)} className="planner-field" placeholder="例: 迫田 幸平" />
        </Field>
        <Field label="表示名">
          <input value={shortName} onChange={(event) => setShortName(event.target.value)} className="planner-field" placeholder="例: 幸平" />
        </Field>
      </EditPanel>

      <section className="planner-card">
        <SectionHeader kicker="LIST" title="登録メンバー" />
        <div className="mt-4 space-y-3">
          {members.map((member) => (
            <RowActions key={member.id} title={member.name} note={`表示名: ${member.shortName}`} onEdit={() => edit(member)} onDelete={() => void remove(member)} />
          ))}
        </div>
      </section>
    </SettingsLayout>
  );
}

function ShopManager({
  onBack,
  mode,
  title,
}: {
  onBack: () => void;
  mode: "general" | "medical";
  title: string;
}) {
  const [shops, setShops] = useState<ShopMaster[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shopType, setShopType] = useState<ShopMaster["shopType"]>(mode === "general" ? "general" : "hospital");

  const load = async () => {
    const rows = await db.shopMasters.toArray();
    setShops(
      rows
        .filter((row) => row.isActive)
        .filter((row) => (mode === "general" ? row.shopType === "general" : row.shopType !== "general"))
        .sort((left, right) => right.usageCount - left.usageCount),
    );
  };

  useEffect(() => {
    void load();
  }, [mode]);

  const reset = () => {
    setEditingId(null);
    setName("");
    setShopType(mode === "general" ? "general" : "hospital");
  };

  const save = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await db.shopMasters.update(editingId, { name: name.trim(), shopType });
    } else {
      await db.shopMasters.add({
        id: uuid(),
        name: name.trim(),
        shopType,
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      });
    }

    reset();
    await load();
  };

  const edit = (shop: ShopMaster) => {
    setEditingId(shop.id);
    setName(shop.name);
    setShopType(shop.shopType);
  };

  const remove = async (shop: ShopMaster) => {
    if (!window.confirm(`${shop.name} を停止しますか。`)) return;
    await db.shopMasters.update(shop.id, { isActive: false });
    await load();
  };

  return (
    <SettingsLayout title={title} onBack={onBack}>
      <EditPanel title={editingId ? "店舗を編集" : "店舗を追加"} onSave={save} onCancel={reset} saveLabel={editingId ? "更新" : "追加"}>
        <Field label="名称">
          <input value={name} onChange={(event) => setName(event.target.value)} className="planner-field" placeholder="名称" />
        </Field>
        {mode === "medical" ? (
          <Field label="種別">
            <div className="planner-pill-grid">
              {[
                { value: "hospital", label: "病院" },
                { value: "pharmacy", label: "薬局" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setShopType(option.value as ShopMaster["shopType"])}
                  className={`planner-pill ${shopType === option.value ? "planner-pill-active" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
        ) : null}
      </EditPanel>

      <section className="planner-card">
        <SectionHeader kicker="LIST" title="登録一覧" />
        <div className="mt-4 space-y-3">
          {shops.map((shop) => (
            <RowActions
              key={shop.id}
              title={shop.name}
              note={`利用 ${shop.usageCount} 回 / ${shop.shopType === "general" ? "一般店舗" : shop.shopType === "hospital" ? "病院" : "薬局"}`}
              onEdit={() => edit(shop)}
              onDelete={() => void remove(shop)}
            />
          ))}
        </div>
      </section>
    </SettingsLayout>
  );
}

function CategoryManager({ onBack }: { onBack: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [colorHex, setColorHex] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);

  const load = async () => {
    setCategories(await db.categories.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)));
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setIcon(CATEGORY_ICON_OPTIONS[0]);
    setColorHex(CATEGORY_COLOR_OPTIONS[0]);
  };

  const save = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await db.categories.update(editingId, { name: name.trim(), icon, colorHex });
    } else {
      await db.categories.add({
        id: uuid(),
        name: name.trim(),
        icon,
        colorHex,
        sortOrder: categories.length,
        isMedical: false,
        isFixed: false,
        isCustom: true,
        isActive: true,
      });
    }

    reset();
    await load();
  };

  const edit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setIcon(category.icon || CATEGORY_ICON_OPTIONS[0]);
    setColorHex(category.colorHex || CATEGORY_COLOR_OPTIONS[0]);
  };

  const remove = async (category: Category) => {
    if (!category.isCustom) {
      window.alert("標準カテゴリは停止できません。色やアイコンの編集のみ可能です。");
      return;
    }
    if (!window.confirm(`${category.name} を停止しますか。`)) return;
    await db.categories.update(category.id, { isActive: false });
    await load();
  };

  return (
    <SettingsLayout title="カテゴリ" onBack={onBack}>
      <EditPanel title={editingId ? "カテゴリを編集" : "カテゴリを追加"} onSave={save} onCancel={reset} saveLabel={editingId ? "更新" : "追加"}>
        <Field label="カテゴリ名">
          <input value={name} onChange={(event) => setName(event.target.value)} className="planner-field" placeholder="例: ペット費" />
        </Field>
        <Field label="アイコン">
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_ICON_OPTIONS.map((iconName) => {
              const Icon = resolveIcon(iconName, "ReceiptText");
              const active = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className="planner-category-chip"
                  style={{
                    borderColor: active ? colorHex : "var(--planner-line)",
                    backgroundColor: active ? `${colorHex}18` : "var(--planner-paper)",
                    color: active ? colorHex : "var(--planner-text)",
                  }}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="色">
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_COLOR_OPTIONS.map((color) => (
              <button key={color} type="button" onClick={() => setColorHex(color)} className="h-10 rounded-[12px] border" style={{ backgroundColor: color, borderColor: colorHex === color ? "#ffffff" : "transparent", boxShadow: colorHex === color ? `0 0 0 2px ${color}` : "none" }} />
            ))}
          </div>
        </Field>
      </EditPanel>

      <section className="planner-card">
        <SectionHeader kicker="LIST" title="カテゴリ一覧" />
        <div className="mt-4 space-y-3">
          {categories.map((category) => {
            const Icon = resolveIcon(category.icon, "ReceiptText");
            return (
              <div key={category.id} className="planner-list-row">
                <div className="planner-summary-icon" style={{ backgroundColor: `${category.colorHex}18`, color: category.colorHex }}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{category.name}</p>
                  <p className="text-xs text-[var(--planner-subtle)]">{category.isCustom ? "追加カテゴリ" : "標準カテゴリ"}</p>
                </div>
                <button type="button" onClick={() => edit(category)} className="planner-icon-button" aria-label="カテゴリを編集">
                  <Edit3 size={14} />
                </button>
                <button type="button" onClick={() => void remove(category)} className="planner-icon-button" aria-label="カテゴリを削除">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </SettingsLayout>
  );
}

function FixedManager({ onBack }: { onBack: () => void }) {
  const today = new Date();
  const [templates, setTemplates] = useState<FixedExpenseTemplate[]>([]);
  const [monthRecords, setMonthRecords] = useState<FixedExpenseRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const load = async () => {
    const [templateRows, recordRows] = await Promise.all([
      db.fixedTemplates.orderBy("sortOrder").toArray().then((rows) => rows.filter((row) => row.isActive)),
      getMonthlyFixedRecords(today.getFullYear(), today.getMonth() + 1),
    ]);
    setTemplates(templateRows);
    setMonthRecords(recordRows);
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setAmount("");
  };

  const save = async () => {
    const parsedAmount = Number(amount);
    if (!name.trim() || !parsedAmount) return;

    if (editingId) {
      await db.fixedTemplates.update(editingId, { name: name.trim(), defaultAmount: Math.round(parsedAmount) });
    } else {
      await db.fixedTemplates.add({
        id: uuid(),
        name: name.trim(),
        defaultAmount: Math.round(parsedAmount),
        dayOfMonth: 1,
        isActive: true,
        sortOrder: templates.length,
      });
    }

    reset();
    await load();
  };

  const edit = (template: FixedExpenseTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setAmount(String(template.defaultAmount));
  };

  const remove = async (template: FixedExpenseTemplate) => {
    if (!window.confirm(`${template.name} を停止しますか。`)) return;
    await db.fixedTemplates.update(template.id, { isActive: false });
    await load();
  };

  return (
    <SettingsLayout title="固定費テンプレート" onBack={onBack}>
      <EditPanel title={editingId ? "固定費を編集" : "固定費を追加"} onSave={save} onCancel={reset} saveLabel={editingId ? "更新" : "追加"}>
        <Field label="名称">
          <input value={name} onChange={(event) => setName(event.target.value)} className="planner-field" placeholder="例: 電気代" />
        </Field>
        <Field label="標準金額">
          <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" className="planner-field" placeholder="8000" />
        </Field>
      </EditPanel>

      <section className="planner-card">
        <SectionHeader kicker="TEMPLATES" title="固定費テンプレート" />
        <div className="mt-4 space-y-3">
          {templates.map((template) => (
            <RowActions key={template.id} title={template.name} note={`標準金額 ${formatYen(template.defaultAmount)}`} onEdit={() => edit(template)} onDelete={() => void remove(template)} />
          ))}
        </div>
      </section>

      <section className="planner-card">
        <SectionHeader kicker="THIS MONTH" title="今月の固定費" />
        <div className="mt-4 space-y-3">
          {monthRecords.length === 0 ? (
            <EmptyState title="今月の固定費は未生成です" message="テンプレート登録後に今月分の固定費が自動生成されます。" />
          ) : (
            monthRecords.map((record) => {
              const template = templates.find((item) => item.id === record.templateId);
              return (
                <div key={record.id} className="planner-summary-row">
                  <div className="planner-summary-icon bg-[rgba(72,108,165,0.12)] text-[var(--planner-accent)]">
                    <Edit3 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{template?.name || "固定費"}</p>
                    <p className="text-xs text-[var(--planner-subtle)]">{record.isConfirmed ? "確認済み" : "未確認"}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatYen(record.actualAmount)}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </SettingsLayout>
  );
}

function SettingsLayout({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="planner-page">
      <section className="planner-card">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="planner-icon-button" aria-label="戻る">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="planner-kicker">SETTINGS</p>
            <h1 className="planner-section-title">{title}</h1>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function EditPanel({
  title,
  onSave,
  onCancel,
  saveLabel,
  children,
}: {
  title: string;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="planner-card">
      <SectionHeader kicker="EDIT" title={title} />
      <div className="mt-4 space-y-4">{children}</div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="planner-secondary-inline">
          クリア
        </button>
        <button type="button" onClick={onSave} className="planner-primary-inline planner-primary-inline-accent">
          {saveLabel}
        </button>
      </div>
    </section>
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

function RowActions({
  title,
  note,
  onEdit,
  onDelete,
}: {
  title: string;
  note: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="planner-list-row">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-[var(--planner-subtle)]">{note}</p>
      </div>
      <button type="button" onClick={onEdit} className="planner-icon-button" aria-label="編集">
        <Edit3 size={14} />
      </button>
      <button type="button" onClick={onDelete} className="planner-icon-button" aria-label="削除">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
