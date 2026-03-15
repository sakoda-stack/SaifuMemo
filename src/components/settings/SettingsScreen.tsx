import { type ReactNode, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { db } from "@/db/database";
import { formatYen } from "@/utils";
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, resolveIcon } from "@/utils/icons";
import type { Category, FixedExpenseRecord, FixedExpenseTemplate, Member, ShopMaster } from "@/types";

type Section = "menu" | "members" | "hospitals" | "shops" | "categories" | "fixed" | "fixed-month" | "checklist";

const CHECKLIST = [
  { id: "1", title: "医療費明細をすべて入力した", sub: "病院代、薬代、通院交通費まで確認" },
  { id: "2", title: "補填された金額を入力した", sub: "保険金や高額療養費がある場合のみ" },
  { id: "3", title: "家族全員分を確認した", sub: "医療費タブで人別に見直し" },
  { id: "4", title: "CSV を出力して確認した", sub: "e-Tax に取り込む前に Excel で確認" },
];

export default function SettingsScreen() {
  const [section, setSection] = useState<Section>("menu");
  const today = new Date();

  if (section === "members") {
    return <MembersSection onBack={() => setSection("menu")} />;
  }
  if (section === "hospitals") {
    return <ShopsSection onBack={() => setSection("menu")} type="hospital" title="病院・薬局マスタ" />;
  }
  if (section === "shops") {
    return <ShopsSection onBack={() => setSection("menu")} type="general" title="店舗マスタ" />;
  }
  if (section === "categories") {
    return <CategoriesSection onBack={() => setSection("menu")} />;
  }
  if (section === "fixed") {
    return <FixedTemplatesSection onBack={() => setSection("menu")} />;
  }
  if (section === "fixed-month") {
    return <FixedMonthSection onBack={() => setSection("menu")} year={today.getFullYear()} month={today.getMonth() + 1} />;
  }
  if (section === "checklist") {
    return <ChecklistSection onBack={() => setSection("menu")} />;
  }

  return (
    <div className="planner-page slide-up">
      <section className="planner-card">
        <p className="planner-kicker">整える</p>
        <h1 className="planner-heading mt-2">家計のマスタ設定</h1>
        <p className="mt-3 text-sm text-[var(--planner-subtle)]">
          サンプルは最初から入るように補強してあります。カテゴリはアイコンと色を後から変更できます。
        </p>
      </section>

      <MenuGroup
        title="マスタ管理"
        items={[
          { icon: "👨‍👩‍👧‍👦", label: "家族メンバー", note: "登録する人の表示名を整理", onTap: () => setSection("members") },
          { icon: "🏥", label: "病院・薬局マスタ", note: "医療費入力で使う候補", onTap: () => setSection("hospitals") },
          { icon: "🧺", label: "店舗マスタ", note: "日常の買い物先を登録", onTap: () => setSection("shops") },
          { icon: "🏷️", label: "カテゴリ管理", note: "アイコンと色を編集可能", onTap: () => setSection("categories") },
        ]}
      />

      <MenuGroup
        title="固定費"
        items={[
          { icon: "🔁", label: "固定費テンプレート", note: "毎月の初期値を設定", onTap: () => setSection("fixed") },
          { icon: "📅", label: "今月の固定費", note: "当月金額の見直し", onTap: () => setSection("fixed-month") },
        ]}
      />

      <MenuGroup
        title="申告準備"
        items={[{ icon: "✅", label: "申告チェック", note: "提出前の抜け漏れ確認", onTap: () => setSection("checklist") }]}
      />
    </div>
  );
}

function MenuGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: string; label: string; note: string; onTap: () => void }>;
}) {
  return (
    <section className="planner-card">
      <p className="planner-kicker">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <button key={item.label} type="button" onClick={item.onTap} className="planner-row w-full text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[var(--planner-soft)] text-xl">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-[var(--planner-text)]">{item.label}</strong>
              <span className="text-xs text-[var(--planner-subtle)]">{item.note}</span>
            </span>
            <ChevronRight size={18} className="text-[var(--planner-subtle)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function MembersSection({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");

  const load = () => db.members.orderBy("sortOrder").toArray().then((rows) => setMembers(rows.filter((member) => member.isActive)));

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setShortName("");
    setIsEditing(false);
  };

  const openEdit = (member: Member) => {
    setEditingId(member.id);
    setName(member.name);
    setShortName(member.shortName);
    setIsEditing(true);
  };

  const save = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await db.members.update(editingId, { name: name.trim(), shortName: shortName.trim() || name.trim() });
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
    load();
  };

  const remove = async (member: Member) => {
    if (confirm(`${member.name}を削除しますか？`)) {
      await db.members.update(member.id, { isActive: false });
      load();
    }
  };

  return (
    <SectionLayout title="家族メンバー" onBack={onBack} onAdd={() => setIsEditing((current) => !current)}>
      {isEditing && (
        <div className="planner-form-panel">
          <label className="planner-label">フルネーム</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: 迫田 玲美" className="planner-field" />
          <label className="planner-label mt-3">短い名前</label>
          <input
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
            placeholder="例: 玲美"
            className="planner-field"
          />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="planner-action flex-1 bg-[var(--planner-line)] text-[var(--planner-text)]">
              キャンセル
            </button>
            <button type="button" onClick={save} className="planner-action flex-1 bg-[var(--planner-accent)] text-white">
              {editingId ? "更新" : "追加"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {members.map((member) => (
          <MasterRow
            key={member.id}
            title={member.name}
            note={`表示名: ${member.shortName}`}
            onEdit={() => openEdit(member)}
            onDelete={() => remove(member)}
          />
        ))}
      </div>
    </SectionLayout>
  );
}

function ShopsSection({
  onBack,
  type,
  title,
}: {
  onBack: () => void;
  type: "hospital" | "general";
  title: string;
}) {
  const [shops, setShops] = useState<ShopMaster[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = () =>
    db.shopMasters
      .toArray()
      .then((rows) =>
        setShops(
          rows
            .filter((shop) => shop.isActive)
            .filter((shop) => (type === "general" ? shop.shopType === "general" : shop.shopType === "hospital" || shop.shopType === "pharmacy"))
            .sort((left, right) => right.usageCount - left.usageCount),
        ),
      );

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setIsEditing(false);
  };

  const openEdit = (shop: ShopMaster) => {
    setEditingId(shop.id);
    setName(shop.name);
    setIsEditing(true);
  };

  const save = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await db.shopMasters.update(editingId, { name: name.trim() });
    } else {
      await db.shopMasters.add({
        id: uuid(),
        name: name.trim(),
        shopType: type === "general" ? "general" : "hospital",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      });
    }

    reset();
    load();
  };

  const remove = async (shop: ShopMaster) => {
    if (confirm(`${shop.name}を削除しますか？`)) {
      await db.shopMasters.update(shop.id, { isActive: false });
      load();
    }
  };

  return (
    <SectionLayout title={title} onBack={onBack} onAdd={() => setIsEditing((current) => !current)}>
      {isEditing && (
        <div className="planner-form-panel">
          <label className="planner-label">名称</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: イオン" className="planner-field" />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="planner-action flex-1 bg-[var(--planner-line)] text-[var(--planner-text)]">
              キャンセル
            </button>
            <button type="button" onClick={save} className="planner-action flex-1 bg-[var(--planner-accent)] text-white">
              {editingId ? "更新" : "追加"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {shops.map((shop) => (
          <MasterRow
            key={shop.id}
            title={shop.name}
            note={`使用回数 ${shop.usageCount}回`}
            onEdit={() => openEdit(shop)}
            onDelete={() => remove(shop)}
          />
        ))}
      </div>
    </SectionLayout>
  );
}

function CategoriesSection({ onBack }: { onBack: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [colorHex, setColorHex] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);

  const load = () => db.categories.orderBy("sortOrder").toArray().then((rows) => setCategories(rows.filter((category) => category.isActive)));

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setIcon(CATEGORY_ICON_OPTIONS[0]);
    setColorHex(CATEGORY_COLOR_OPTIONS[0]);
    setIsEditing(false);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setIcon(category.icon || CATEGORY_ICON_OPTIONS[0]);
    setColorHex(category.colorHex || CATEGORY_COLOR_OPTIONS[0]);
    setIsEditing(true);
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
    load();
  };

  const remove = async (category: Category) => {
    if (!category.isCustom) {
      alert("サンプルカテゴリは削除せず、アイコンや色だけ調整してください。");
      return;
    }

    if (confirm(`${category.name}を削除しますか？`)) {
      await db.categories.update(category.id, { isActive: false });
      load();
    }
  };

  return (
    <SectionLayout title="カテゴリ管理" onBack={onBack} onAdd={() => setIsEditing((current) => !current)}>
      {isEditing && (
        <div className="planner-form-panel">
          <label className="planner-label">カテゴリ名</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: ペット費" className="planner-field" />

          <label className="planner-label mt-4">アイコン</label>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_ICON_OPTIONS.map((iconName) => {
              const Icon = resolveIcon(iconName);
              const active = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className="flex h-11 items-center justify-center rounded-[16px] border"
                  style={{
                    borderColor: active ? colorHex : "var(--planner-line)",
                    backgroundColor: active ? `${colorHex}22` : "white",
                  }}
                >
                  <Icon size={18} color={active ? colorHex : "#8A7D70"} />
                </button>
              );
            })}
          </div>

          <label className="planner-label mt-4">色</label>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setColorHex(color)}
                className="h-10 rounded-[14px] border-2"
                style={{ backgroundColor: color, borderColor: colorHex === color ? "white" : "transparent", boxShadow: colorHex === color ? `0 0 0 2px ${color}` : "none" }}
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="planner-action flex-1 bg-[var(--planner-line)] text-[var(--planner-text)]">
              キャンセル
            </button>
            <button type="button" onClick={save} className="planner-action flex-1 bg-[var(--planner-accent)] text-white">
              {editingId ? "更新" : "追加"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {categories.map((category) => {
          const Icon = resolveIcon(category.icon, "ReceiptText");
          return (
            <div key={category.id} className="planner-row">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: `${category.colorHex}22` }}>
                <Icon size={18} color={category.colorHex} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--planner-text)]">{category.name}</p>
                <p className="text-xs text-[var(--planner-subtle)]">{category.isCustom ? "追加したカテゴリ" : "標準サンプル"}</p>
              </div>
              <button type="button" onClick={() => openEdit(category)} className="text-[var(--planner-subtle)]">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => remove(category)} className="text-[var(--planner-subtle)]">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </SectionLayout>
  );
}

function FixedTemplatesSection({ onBack }: { onBack: () => void }) {
  const [templates, setTemplates] = useState<FixedExpenseTemplate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const load = () => db.fixedTemplates.orderBy("sortOrder").toArray().then((rows) => setTemplates(rows.filter((template) => template.isActive)));

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setAmount("");
    setIsEditing(false);
  };

  const openEdit = (template: FixedExpenseTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setAmount(String(template.defaultAmount));
    setIsEditing(true);
  };

  const save = async () => {
    const parsed = parseInt(amount, 10);
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) return;

    if (editingId) {
      await db.fixedTemplates.update(editingId, { name: name.trim(), defaultAmount: parsed });
    } else {
      await db.fixedTemplates.add({
        id: uuid(),
        name: name.trim(),
        defaultAmount: parsed,
        dayOfMonth: 1,
        isActive: true,
        sortOrder: templates.length,
      });
    }

    reset();
    load();
  };

  const remove = async (template: FixedExpenseTemplate) => {
    if (confirm(`${template.name}を削除しますか？`)) {
      await db.fixedTemplates.update(template.id, { isActive: false });
      load();
    }
  };

  return (
    <SectionLayout title="固定費テンプレート" onBack={onBack} onAdd={() => setIsEditing((current) => !current)}>
      {isEditing && (
        <div className="planner-form-panel">
          <label className="planner-label">名称</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: 電気代" className="planner-field" />
          <label className="planner-label mt-3">標準金額</label>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" placeholder="8000" className="planner-field" />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="planner-action flex-1 bg-[var(--planner-line)] text-[var(--planner-text)]">
              キャンセル
            </button>
            <button type="button" onClick={save} className="planner-action flex-1 bg-[var(--planner-accent)] text-white">
              {editingId ? "更新" : "追加"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template) => (
          <MasterRow
            key={template.id}
            title={template.name}
            note={`標準金額 ${formatYen(template.defaultAmount)}`}
            onEdit={() => openEdit(template)}
            onDelete={() => remove(template)}
          />
        ))}
      </div>
    </SectionLayout>
  );
}

function FixedMonthSection({ onBack, year, month }: { onBack: () => void; year: number; month: number }) {
  const [records, setRecords] = useState<Array<FixedExpenseRecord & { templateName?: string; defaultAmount?: number }>>([]);

  useEffect(() => {
    const load = async () => {
      const [recordRows, templateRows] = await Promise.all([
        db.fixedRecords.where("[year+month]").equals([year, month]).toArray(),
        db.fixedTemplates.toArray(),
      ]);
      const templateMap = new Map(templateRows.map((template) => [template.id, template]));
      setRecords(
        recordRows.map((record) => ({
          ...record,
          templateName: templateMap.get(record.templateId ?? "")?.name,
          defaultAmount: templateMap.get(record.templateId ?? "")?.defaultAmount,
        })),
      );
    };

    load();
  }, [month, year]);

  const updateAmount = async (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      await db.fixedRecords.update(id, { actualAmount: parsed });
    }
  };

  const toggleConfirm = async (id: string, current: boolean) => {
    await db.fixedRecords.update(id, { isConfirmed: !current });
    setRecords((rows) => rows.map((row) => (row.id === id ? { ...row, isConfirmed: !current } : row)));
  };

  return (
    <SectionLayout title={`${year}年${month}月の固定費`} onBack={onBack}>
      <div className="space-y-3">
        {records.map((record) => (
          <div key={record.id} className="planner-row">
            <button type="button" onClick={() => toggleConfirm(record.id, record.isConfirmed)} className="shrink-0">
              {record.isConfirmed ? (
                <CheckCircle2 size={24} className="text-[var(--planner-success)]" />
              ) : (
                <Circle size={24} className="text-[var(--planner-line)]" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--planner-text)]">{record.templateName}</p>
              <p className="text-xs text-[var(--planner-subtle)]">
                {record.defaultAmount ? `標準 ${formatYen(record.defaultAmount)}` : "標準金額なし"}
              </p>
            </div>
            <input
              type="number"
              defaultValue={record.actualAmount}
              onBlur={(event) => updateAmount(record.id, event.target.value)}
              className="w-28 rounded-[16px] border border-[var(--planner-line)] bg-white px-3 py-2 text-right text-sm font-semibold text-[var(--planner-text)]"
            />
          </div>
        ))}
      </div>
    </SectionLayout>
  );
}

function ChecklistSection({ onBack }: { onBack: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const done = Object.values(checks).filter(Boolean).length;

  return (
    <SectionLayout title="申告チェック" onBack={onBack}>
      <div className="planner-card bg-[var(--planner-soft)]">
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-2 rounded-full bg-[var(--planner-accent)]" style={{ width: `${(done / CHECKLIST.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-right text-xs text-[var(--planner-subtle)]">
          {done}/{CHECKLIST.length} 完了
        </p>
      </div>
      <div className="space-y-3">
        {CHECKLIST.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setChecks((current) => ({ ...current, [item.id]: !current[item.id] }))}
            className="planner-row w-full text-left"
          >
            {checks[item.id] ? (
              <CheckCircle2 size={22} className="shrink-0 text-[var(--planner-success)]" />
            ) : (
              <Circle size={22} className="shrink-0 text-[var(--planner-line)]" />
            )}
            <span className="min-w-0 flex-1">
              <strong className={`block text-sm ${checks[item.id] ? "line-through text-[var(--planner-subtle)]" : "text-[var(--planner-text)]"}`}>{item.title}</strong>
              <span className="text-xs text-[var(--planner-subtle)]">{item.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </SectionLayout>
  );
}

function SectionLayout({
  title,
  onBack,
  onAdd,
  children,
}: {
  title: string;
  onBack: () => void;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="planner-page slide-up">
      <section className="planner-card">
        <div className="planner-section-header">
          <button type="button" onClick={onBack} className="planner-icon-button" aria-label="戻る">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="planner-kicker">設定</p>
            <h1 className="planner-heading">{title}</h1>
          </div>
          {onAdd ? (
            <button type="button" onClick={onAdd} className="planner-icon-button" aria-label="追加">
              <Plus size={18} />
            </button>
          ) : (
            <span className="block h-11 w-11" />
          )}
        </div>
      </section>
      {children}
    </div>
  );
}

function MasterRow({
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
    <div className="planner-row">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--planner-text)]">{title}</p>
        <p className="text-xs text-[var(--planner-subtle)]">{note}</p>
      </div>
      <button type="button" onClick={onEdit} className="text-[var(--planner-subtle)]">
        <Pencil size={16} />
      </button>
      <button type="button" onClick={onDelete} className="text-[var(--planner-subtle)]">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
