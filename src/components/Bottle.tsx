import { useEffect, useId, useMemo, useState } from "react";

type BottleProps = {
  currentMl: number;
  maxMl?: number;
  className?: string;
  animateOnMount?: boolean;
  animationDurationMs?: number;
};

const VIEW_WIDTH = 697.34;
const VIEW_HEIGHT = 2444.89;
const DEFAULT_MAX_ML = 500;

const BOTTLE_PATH =
  "M683.71,1606.78c-10.88-364.47-246.43-1451.49-246.43-1451.49h-2.84c20.49,0,36.02-18.47,32.52-38.65l-13.54-77.99c0-21.34-17.3-38.64-38.64-38.64h-145.56c-21.34,0-38.64,17.3-38.64,38.64l-13.54,77.99c-3.5,20.18,12.03,38.65,32.52,38.65h-4.31S47.24,1166.15,20.04,1506.14C6.78,1671.88,0,2322.36,0,2322.36c0,67.67,54.86,122.53,122.53,122.53h452.28c67.67,0,122.53-54.86,122.53-122.53,0,0-5.42-440.65-13.63-715.58Z";

const WAVE_TILE_WIDTH = 240;
const WAVE_TILE_COUNT = Math.ceil(VIEW_WIDTH / WAVE_TILE_WIDTH) + 4;
const WAVE_OFFSET_Y = 120;
const WAVE_FILL_BOTTOM = VIEW_HEIGHT + 300;

const MAIN_WAVE_PATH = `
  M0 120
  C20 120 30 48 60 48
  C90 48 100 120 120 120
  C140 120 150 192 180 192
  C210 192 220 120 240 120
  V${WAVE_FILL_BOTTOM}
  H0
  Z
`;

const SECONDARY_WAVE_PATH = `
  M0 120
  C22 120 34 78 60 78
  C86 78 98 120 120 120
  C142 120 154 156 180 156
  C206 156 218 120 240 120
  V${WAVE_FILL_BOTTOM}
  H0
  Z
`;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function renderWaveTiles(
  path: string,
  fill: string,
  keyPrefix: string,
  xOffset = 0,
) {
  return Array.from({ length: WAVE_TILE_COUNT }, (_, index) => (
    <path
      key={`${keyPrefix}-${index}`}
      d={path}
      transform={`translate(${xOffset + index * WAVE_TILE_WIDTH} 0)`}
      fill={fill}
    />
  ));
}

export default function Bottle({
  currentMl,
  maxMl = DEFAULT_MAX_ML,
  className,
  animateOnMount = false,
  animationDurationMs = 2000,
}: BottleProps) {
  const rawId = useId();
  const clipId = `bottle-clip-${rawId.replace(/[:]/g, "")}`;

  const safeMaxMl = useMemo(() => {
    if (!Number.isFinite(maxMl) || maxMl <= 0) {
      return DEFAULT_MAX_ML;
    }
    return maxMl;
  }, [maxMl]);

  const safeTargetMl = useMemo(() => {
    const normalizedCurrentMl = Number.isFinite(currentMl) ? currentMl : 0;
    return clamp(normalizedCurrentMl, 0, safeMaxMl);
  }, [currentMl, safeMaxMl]);

  const [progress, setProgress] = useState(() => (animateOnMount ? 0 : 1));

  useEffect(() => {
    if (!animateOnMount) {
      setProgress(1);
      return;
    }

    setProgress(0);

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const duration = animationDurationMs > 0 ? animationDurationMs : 1;
      const linear = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - linear, 3);

      setProgress(clamp(eased, 0, 1));

      if (linear < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [animateOnMount, animationDurationMs]);

  const clampedProgress = clamp(progress, 0, 1);
  const displayMl = clamp(safeTargetMl * clampedProgress, 0, safeMaxMl);
  const fillRatio = clamp(displayMl / safeMaxMl, 0, 1);
  const fillHeight = clamp(VIEW_HEIGHT * fillRatio, 0, VIEW_HEIGHT);
  const fillY = clamp(VIEW_HEIGHT - fillHeight, 0, VIEW_HEIGHT);
  const waveBaseY = fillY - WAVE_OFFSET_Y;
  const hasWater = fillHeight > 0;

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={`Water bottle filled to ${Math.round(displayMl)} milliliters out of ${safeMaxMl} milliliters`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BOTTLE_PATH} />
        </clipPath>
      </defs>

      <path
        d={BOTTLE_PATH}
        fill="rgba(255,255,255,0.14)"
        stroke="#ffffff"
        strokeWidth="18"
      />

      <g clipPath={`url(#${clipId})`}>
        <rect
          x="0"
          y={fillY}
          width={VIEW_WIDTH}
          height={fillHeight}
          fill="rgba(64, 182, 255, 0.74)"
        />

        {hasWater && (
          <g transform={`translate(0 ${waveBaseY})`}>
            <g opacity="0.55">
              {animateOnMount && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`
                    0 0;
                    -40 -10;
                    -90 6;
                    -40 8;
                    0 0
                  `}
                  dur={`${animationDurationMs}ms`}
                  repeatCount="1"
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0; 0.25; 0.5; 0.75; 1"
                  keySplines="
                    0.42 0 0.58 1;
                    0.42 0 0.58 1;
                    0.42 0 0.58 1;
                    0.42 0 0.58 1
                  "
                />
              )}

              {renderWaveTiles(
                MAIN_WAVE_PATH,
                "rgba(84, 191, 255, 0.82)",
                "main-wave",
              )}
            </g>

            <g opacity="0.34">
              {animateOnMount && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`
                    0 0;
                    -24 6;
                    -60 -5;
                    -24 4;
                    0 0
                  `}
                  dur={`${animationDurationMs}ms`}
                  repeatCount="1"
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0; 0.25; 0.5; 0.75; 1"
                  keySplines="
                    0.42 0 0.58 1;
                    0.42 0 0.58 1;
                    0.42 0 0.58 1;
                    0.42 0 0.58 1
                  "
                />
              )}

              {renderWaveTiles(
                SECONDARY_WAVE_PATH,
                "rgba(255, 255, 255, 0.42)",
                "secondary-wave",
                -8,
              )}
            </g>
          </g>
        )}
      </g>

      <text
        x={VIEW_WIDTH / 2}
        y={VIEW_HEIGHT - 280}
        textAnchor="middle"
        fill="#2f6b98"
        fontSize="56"
        fontWeight="700"
      >
        USAGE TODAY
      </text>

      <text
        x={VIEW_WIDTH / 2}
        y={VIEW_HEIGHT - 165}
        textAnchor="middle"
        fill="#2f6b98"
        fontSize="110"
        fontWeight="700"
      >
        {Math.round(displayMl)} mL
      </text>
    </svg>
  );
}