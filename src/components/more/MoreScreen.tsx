import { HeartPulse, Settings, Store } from "lucide-react";
import { ActionCard, ScreenIntro, SectionHeader } from "@/components/ui/PlannerUI";

interface MoreScreenProps {
  onOpenCompare: () => void;
  onOpenMedical: () => void;
  onOpenSettings: () => void;
}

export default function MoreScreen({
  onOpenCompare,
  onOpenMedical,
  onOpenSettings,
}: MoreScreenProps) {
  return (
    <div className="planner-page">
      <ScreenIntro
        kicker="OTHER"
        title="その他"
        description="分析、医療費ダッシュボード、各種設定をまとめています。"
      />

      <section className="planner-card">
        <SectionHeader kicker="WORKSPACE" title="よく使う機能" description="集計と管理をここから開けます。" />
        <div className="mt-4 grid gap-3">
          <ActionCard
            title="スーパー分析"
            description="商品別の最安店や、各スーパーの得意商品を確認"
            icon={<Store size={18} />}
            tone="accent"
            onClick={onOpenCompare}
          />
          <ActionCard
            title="医療費ダッシュボード"
            description="年間合計、月別推移、家族別の医療費を整理"
            icon={<HeartPulse size={18} />}
            tone="medical"
            onClick={onOpenMedical}
          />
          <ActionCard
            title="設定"
            description="家族、店舗、カテゴリ、固定費、OCR確認を管理"
            icon={<Settings size={18} />}
            tone="soft"
            onClick={onOpenSettings}
          />
        </div>
      </section>
    </div>
  );
}
