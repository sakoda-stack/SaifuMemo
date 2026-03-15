import type { ReactNode } from "react";

export function ScreenIntro({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="planner-card planner-hero">
      <div className="planner-hero-rule" />
      <div className="planner-hero-body">
        <div className="min-w-0 flex-1">
          <p className="planner-kicker">{kicker}</p>
          <h1 className="planner-title">{title}</h1>
          {description ? <p className="planner-description">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function SectionHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="planner-section-header">
      <div className="min-w-0">
        <p className="planner-kicker">{kicker}</p>
        <h2 className="planner-section-title">{title}</h2>
        {description ? <p className="planner-section-description">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "accent" | "medical";
}) {
  return (
    <article className={`planner-metric planner-metric-${tone}`}>
      <p className="planner-metric-label">{label}</p>
      <p className="planner-metric-value">{value}</p>
      {note ? <p className="planner-metric-note">{note}</p> : null}
    </article>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="planner-empty">
      <p className="planner-empty-title">{title}</p>
      <p className="planner-empty-text">{message}</p>
    </div>
  );
}

export function ActionCard({
  title,
  description,
  icon,
  tone = "default",
  onClick,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  tone?: "default" | "accent" | "medical" | "soft";
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`planner-action-icon planner-action-icon-${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <strong className="planner-action-title">{title}</strong>
        {description ? <span className="planner-action-note">{description}</span> : null}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="planner-action-card">{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className="planner-action-card planner-action-button">
      {content}
    </button>
  );
}

export function StickyActionBar({
  primaryLabel,
  primaryTone = "accent",
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  primaryTone?: "accent" | "medical";
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="planner-sticky-bar">
      {secondaryLabel && onSecondary ? (
        <button type="button" onClick={onSecondary} className="planner-secondary-button">
          {secondaryLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className={`planner-primary-button planner-primary-button-${primaryTone}`}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

export function DataBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "accent" | "medical" | "warning";
}) {
  return <span className={`planner-badge planner-badge-${tone}`}>{label}</span>;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="planner-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`planner-segmented-option ${value === option.value ? "planner-segmented-option-active" : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
