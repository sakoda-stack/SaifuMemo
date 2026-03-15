import { formatYen } from "@/utils";

interface BreakdownSegment {
  id: string;
  kind: "category" | "medical";
  label: string;
  color: string;
  total: number;
  share: number;
  isActive: boolean;
  categoryId?: string;
}

interface ExpenseBreakdownDonutProps {
  segments: BreakdownSegment[];
  activeLabel?: string;
  onSelect: (segment: Pick<BreakdownSegment, "kind" | "label" | "categoryId">) => void;
}

const VIEW_BOX = 260;
const CENTER = VIEW_BOX / 2;
const RADIUS = 68;
const STROKE_WIDTH = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_LABEL_THRESHOLD = 0.14;

export default function ExpenseBreakdownDonut({ segments, activeLabel, onSelect }: ExpenseBreakdownDonutProps) {
  let progress = 0;
  const labelData = segments.map((segment) => {
    const startRatio = progress;
    progress += segment.share;
    const endRatio = progress;
    const middleRatio = startRatio + (endRatio - startRatio) / 2;
    const angle = middleRatio * Math.PI * 2 - Math.PI / 2;
    const isRightSide = Math.cos(angle) >= 0;

    return {
      ...segment,
      angle,
      isRightSide,
      innerX: CENTER + Math.cos(angle) * (RADIUS - STROKE_WIDTH * 0.52),
      innerY: CENTER + Math.sin(angle) * (RADIUS - STROKE_WIDTH * 0.52),
      lineStartX: CENTER + Math.cos(angle) * (RADIUS + STROKE_WIDTH / 2 - 2),
      lineStartY: CENTER + Math.sin(angle) * (RADIUS + STROKE_WIDTH / 2 - 2),
      lineMidX: CENTER + Math.cos(angle) * (RADIUS + 18),
      lineMidY: CENTER + Math.sin(angle) * (RADIUS + 18),
      outerLabelX: CENTER + (isRightSide ? 90 : -90),
      outerLabelY: CENTER + Math.sin(angle) * 84,
      textAnchor: isRightSide ? ("start" as const) : ("end" as const),
      useInnerLabel: segment.share >= INNER_LABEL_THRESHOLD,
    };
  });

  const adjustedLabels = spreadOuterLabels(labelData);
  let drawProgress = 0;

  return (
    <div className="planner-breakdown">
      <div className="planner-breakdown-chart">
        <svg viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`} className="planner-breakdown-svg" role="img" aria-label="支出構成比の円グラフ">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--planner-soft)" strokeWidth={STROKE_WIDTH} />

          {segments.map((segment) => {
            const length = Math.max(segment.share * CIRCUMFERENCE, 0);
            const offset = -drawProgress * CIRCUMFERENCE;
            drawProgress += segment.share;

            return (
              <circle
                key={segment.id}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={segment.isActive ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                strokeDasharray={`${Math.max(length - 3, 0)} ${Math.max(CIRCUMFERENCE - length + 3, 0)}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                className="planner-breakdown-segment"
                style={{ opacity: segment.isActive || !activeLabel ? 1 : 0.7 }}
                onClick={() => onSelect(segment)}
              />
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={RADIUS - STROKE_WIDTH / 2 - 3} fill="var(--planner-paper)" stroke="rgba(215,204,187,0.55)" strokeWidth="1" />

          {adjustedLabels.map((segment) =>
            segment.useInnerLabel ? (
              <text key={`${segment.id}-inner`} x={segment.innerX} y={segment.innerY} textAnchor="middle" className="planner-breakdown-inner-label" onClick={() => onSelect(segment)}>
                {segment.label}
              </text>
            ) : (
              <g key={`${segment.id}-outer`} className="planner-breakdown-outer-label" onClick={() => onSelect(segment)}>
                <path
                  d={`M ${segment.lineStartX} ${segment.lineStartY} L ${segment.lineMidX} ${segment.lineMidY} L ${segment.outerLabelX + (segment.isRightSide ? -8 : 8)} ${segment.outerLabelY}`}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={segment.lineStartX} cy={segment.lineStartY} r="2.4" fill={segment.color} />
                <text x={segment.outerLabelX} y={segment.outerLabelY + 4} textAnchor={segment.textAnchor} className="planner-breakdown-outer-text">
                  {segment.label}
                </text>
              </g>
            ),
          )}
        </svg>
      </div>

      <div className="planner-breakdown-legend">
        {segments.map((segment) => (
          <button key={segment.id} type="button" onClick={() => onSelect(segment)} className={`planner-breakdown-legend-item ${segment.isActive ? "planner-breakdown-legend-item-active" : ""}`}>
            <span className="planner-breakdown-legend-swatch" style={{ backgroundColor: segment.color, boxShadow: `0 0 0 2px ${segment.color}22` }} />
            <span className="min-w-0 flex-1">
              <span className="planner-breakdown-legend-top">
                <span className="planner-breakdown-legend-label">{segment.label}</span>
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

function spreadOuterLabels<T extends { useInnerLabel: boolean; isRightSide: boolean; outerLabelY: number }>(segments: T[]) {
  const minGap = 16;
  const top = 24;
  const bottom = VIEW_BOX - 24;
  const result = [...segments];

  ([true, false] as const).forEach((side) => {
    const indices = result
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => !segment.useInnerLabel && segment.isRightSide === side)
      .sort((left, right) => left.segment.outerLabelY - right.segment.outerLabelY);

    let previousY = top - minGap;
    indices.forEach(({ segment }) => {
      segment.outerLabelY = Math.max(segment.outerLabelY, previousY + minGap);
      previousY = segment.outerLabelY;
    });

    let nextY = bottom + minGap;
    [...indices].reverse().forEach(({ segment }) => {
      segment.outerLabelY = Math.min(segment.outerLabelY, nextY - minGap);
      nextY = segment.outerLabelY;
    });
  });

  return result;
}
