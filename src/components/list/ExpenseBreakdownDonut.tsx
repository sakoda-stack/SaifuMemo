import type { CSSProperties } from "react";
import { formatYen } from "@/utils";

interface BreakdownSegment {
  id: string;
  kind: "category" | "medical" | "fixed";
  label: string;
  color: string;
  total: number;
  share: number;
  isActive: boolean;
  categoryId?: string;
}

interface ExpenseBreakdownDonutProps {
  segments: BreakdownSegment[];
  total: number;
  activeLabel?: string;
  onSelect: (segment: Pick<BreakdownSegment, "kind" | "label" | "categoryId">) => void;
}

const CHART_SIZE = 168;
const STROKE_WIDTH = 22;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ExpenseBreakdownDonut({ segments, total, activeLabel, onSelect }: ExpenseBreakdownDonutProps) {
  let progress = 0;

  return (
    <div className="planner-breakdown">
      <div className="planner-breakdown-chart">
        <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} className="planner-breakdown-svg" role="img" aria-label="全支出の内訳">
          <circle cx={CHART_SIZE / 2} cy={CHART_SIZE / 2} r={RADIUS} fill="none" stroke="var(--planner-soft)" strokeWidth={STROKE_WIDTH} />
          {segments.map((segment) => {
            const length = Math.max(segment.share * CIRCUMFERENCE, 0);
            const offset = -progress * CIRCUMFERENCE;
            progress += segment.share;

            return (
              <circle
                key={segment.id}
                cx={CHART_SIZE / 2}
                cy={CHART_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={segment.isActive ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                strokeDasharray={`${length} ${Math.max(CIRCUMFERENCE - length, 0)}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                className="planner-breakdown-segment"
                style={{ opacity: segment.isActive || !activeLabel ? 1 : 0.72 } as CSSProperties}
                onClick={() => onSelect(segment)}
              />
            );
          })}
        </svg>

        <div className="planner-breakdown-center">
          <span className="planner-breakdown-center-label">合計</span>
          <strong className="planner-breakdown-center-value">{formatYen(total)}</strong>
          {activeLabel ? <span className="planner-breakdown-center-note">{activeLabel}</span> : null}
        </div>
      </div>

      <div className="planner-breakdown-legend">
        {segments.map((segment) => (
          <button key={segment.id} type="button" onClick={() => onSelect(segment)} className={`planner-breakdown-legend-item ${segment.isActive ? "planner-breakdown-legend-item-active" : ""}`}>
            <span className="planner-breakdown-legend-swatch" style={{ backgroundColor: segment.color }} />
            <span className="min-w-0 flex-1">
              <span className="planner-breakdown-legend-top">
                <span className="truncate">{segment.label}</span>
                <span>{formatYen(segment.total)}</span>
              </span>
              <span className="planner-breakdown-legend-bottom">{Math.round(segment.share * 1000) / 10}%</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
