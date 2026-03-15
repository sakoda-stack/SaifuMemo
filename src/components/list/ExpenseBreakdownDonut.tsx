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
const RADIUS = 78;
const INNER_LABEL_THRESHOLD = 0.16;
const EXPLODE_OFFSET = 8;

export default function ExpenseBreakdownDonut({ segments, activeLabel, onSelect }: ExpenseBreakdownDonutProps) {
  let progress = 0;
  const total = segments.reduce((sum, segment) => sum + segment.total, 0);

  const sliceData = segments.map((segment) => {
    const startRatio = progress;
    progress += segment.share;
    const endRatio = progress;
    const middleRatio = startRatio + (endRatio - startRatio) / 2;
    const startAngle = startRatio * Math.PI * 2 - Math.PI / 2;
    const endAngle = endRatio * Math.PI * 2 - Math.PI / 2;
    const middleAngle = middleRatio * Math.PI * 2 - Math.PI / 2;
    const isRightSide = Math.cos(middleAngle) >= 0;
    const isActive = segment.isActive || (!activeLabel && segments.length === 1);
    const offset = isActive ? EXPLODE_OFFSET : 0;
    const offsetX = Math.cos(middleAngle) * offset;
    const offsetY = Math.sin(middleAngle) * offset;

    return {
      ...segment,
      displayColor: segment.color,
      isActive,
      middleAngle,
      isRightSide,
      offsetX,
      offsetY,
      percentage: total > 0 ? (segment.total / total) * 100 : 0,
      innerX: CENTER + offsetX + Math.cos(middleAngle) * 44,
      innerY: CENTER + offsetY + Math.sin(middleAngle) * 44,
      lineStartX: CENTER + offsetX + Math.cos(middleAngle) * RADIUS,
      lineStartY: CENTER + offsetY + Math.sin(middleAngle) * RADIUS,
      lineMidX: CENTER + offsetX + Math.cos(middleAngle) * (RADIUS + 14),
      lineMidY: CENTER + offsetY + Math.sin(middleAngle) * (RADIUS + 14),
      outerLabelX: CENTER + (isRightSide ? 100 : -100),
      outerLabelY: CENTER + Math.sin(middleAngle) * 92,
      textAnchor: isRightSide ? ("start" as const) : ("end" as const),
      useInnerLabel: segment.share >= INNER_LABEL_THRESHOLD,
      path: createSlicePath(startAngle, endAngle, offsetX, offsetY),
    };
  });

  const adjustedLabels = spreadOuterLabels(sliceData);
  const activeSegment = adjustedLabels.find((segment) => segment.isActive) ?? adjustedLabels[0];

  return (
    <div className="planner-breakdown">
      <div className="planner-breakdown-chart-wrap">
        <div className="planner-breakdown-chart">
          <svg viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`} className="planner-breakdown-svg" role="img" aria-label="支出構成比の円グラフ">
            {adjustedLabels.map((segment) => (
              <path
                key={segment.id}
                d={segment.path}
                fill={segment.displayColor}
                className="planner-breakdown-slice"
                style={{ opacity: activeLabel && !segment.isActive ? 0.84 : 1 }}
                onClick={() => onSelect(segment)}
              />
            ))}

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
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <text x={segment.outerLabelX} y={segment.outerLabelY + 4} textAnchor={segment.textAnchor} className="planner-breakdown-outer-text">
                    {segment.label}
                  </text>
                </g>
              ),
            )}
          </svg>
        </div>

        {activeSegment ? (
          <div className="planner-breakdown-selection">
            <span className="planner-breakdown-selection-chip" style={{ backgroundColor: `${activeSegment.color}18`, color: activeSegment.color }}>
              {activeSegment.label}
            </span>
            <strong className="planner-breakdown-selection-value">{activeSegment.percentage.toFixed(1)}%</strong>
            <span className="planner-breakdown-selection-note">{formatYen(activeSegment.total)}</span>
          </div>
        ) : null}
      </div>

      <div className="planner-breakdown-legend">
        {adjustedLabels.map((segment) => (
          <button key={segment.id} type="button" onClick={() => onSelect(segment)} className={`planner-breakdown-legend-item ${segment.isActive ? "planner-breakdown-legend-item-active" : ""}`}>
            <span className="planner-breakdown-legend-swatch" style={{ backgroundColor: segment.color, boxShadow: `0 0 0 2px ${segment.color}22` }} />
            <span className="min-w-0 flex-1">
              <span className="planner-breakdown-legend-top">
                <span className="planner-breakdown-legend-label">{segment.label}</span>
                <span>{formatYen(segment.total)}</span>
              </span>
              <span className="planner-breakdown-legend-bottom">{segment.percentage.toFixed(1)}%</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(angle: number, radius: number, offsetX = 0, offsetY = 0) {
  return {
    x: CENTER + offsetX + Math.cos(angle) * radius,
    y: CENTER + offsetY + Math.sin(angle) * radius,
  };
}

function createSlicePath(startAngle: number, endAngle: number, offsetX = 0, offsetY = 0) {
  const start = polarToCartesian(startAngle, RADIUS, offsetX, offsetY);
  const end = polarToCartesian(endAngle, RADIUS, offsetX, offsetY);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  const centerX = CENTER + offsetX;
  const centerY = CENTER + offsetY;

  return [`M ${centerX} ${centerY}`, `L ${start.x} ${start.y}`, `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`, "Z"].join(" ");
}

function spreadOuterLabels<T extends { useInnerLabel: boolean; isRightSide: boolean; outerLabelY: number }>(segments: T[]) {
  const minGap = 16;
  const top = 24;
  const bottom = VIEW_BOX - 24;
  const result = [...segments];

  ([true, false] as const).forEach((side) => {
    const sideLabels = result
      .filter((segment) => !segment.useInnerLabel && segment.isRightSide === side)
      .sort((left, right) => left.outerLabelY - right.outerLabelY);

    let previousY = top - minGap;
    sideLabels.forEach((segment) => {
      segment.outerLabelY = Math.max(segment.outerLabelY, previousY + minGap);
      previousY = segment.outerLabelY;
    });

    let nextY = bottom + minGap;
    [...sideLabels].reverse().forEach((segment) => {
      segment.outerLabelY = Math.min(segment.outerLabelY, nextY - minGap);
      nextY = segment.outerLabelY;
    });
  });

  return result;
}
