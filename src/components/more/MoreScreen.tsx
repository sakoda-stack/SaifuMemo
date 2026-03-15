import { HeartPulse, Settings } from "lucide-react";
import { ActionCard, SectionHeader } from "@/components/ui/PlannerUI";

interface MoreScreenProps {
  onOpenMedical: () => void;
  onOpenSettings: () => void;
}

export default function MoreScreen({ onOpenMedical, onOpenSettings }: MoreScreenProps) {
  return (
    <div className="planner-page">
      <section className="planner-card">
        <SectionHeader kicker="MENU" title="その他" />
        <div className="mt-4 grid gap-3">
          <ActionCard title="医療費" icon={<HeartPulse size={18} />} tone="medical" onClick={onOpenMedical} />
          <ActionCard title="設定" icon={<Settings size={18} />} tone="soft" onClick={onOpenSettings} />
        </div>
      </section>
    </div>
  );
}
