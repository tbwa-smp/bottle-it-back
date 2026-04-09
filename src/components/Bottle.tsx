import { useEffect, useId, useMemo, useState } from "react";

type BottleProps = {
  currentMl: number;
  maxMl?: number;
  className?: string;
  animateOnMount?: boolean;
  animationDurationMs?: number;
  animationsEnabled?: boolean;
};

const VIEW_WIDTH = 697.34;
const VIEW_HEIGHT = 2444.89;
const DEFAULT_MAX_ML = 500;

const BOTTLE_PATH =
  "M683.71,1606.78c-10.88-364.47-246.43-1451.49-246.43-1451.49h-2.84c20.49,0,36.02-18.47,32.52-38.65l-13.54-77.99c0-21.34-17.3-38.64-38.64-38.64h-145.56c-21.34,0-38.64,17.3-38.64,38.64l-13.54,77.99c-3.5,20.18,12.03,38.65,32.52,38.65h-4.31S47.24,1166.15,20.04,1506.14C6.78,1671.88,0,2322.36,0,2322.36c0,67.67,54.86,122.53,122.53,122.53h452.28c67.67,0,122.53-54.86,122.53-122.53,0,0-5.42-440.65-13.63-715.58Z";

const WAVE_TILE_WIDTH = 900;
const WAVE_OFFSET_Y = 60;
const WAVE_FILL_BOTTOM = VIEW_HEIGHT + 800;

function makeWavePath(
  tileWidth: number,
  baseline: number,
  amplitude: number,
) {
  const w = tileWidth;
  const b = baseline;
  const a = amplitude;

  return `
    M 0 ${b}
    C ${w * 0.3} ${b - a}, ${w * 0.3} ${b - a}, ${w * 0.5} ${b}
    C ${w * 0.8} ${b + a}, ${w * 0.8} ${b + a}, ${w} ${b}
    V ${WAVE_FILL_BOTTOM}
    H 0
    Z
  `;
}

const REAR_WAVE_PATH = makeWavePath(WAVE_TILE_WIDTH, 120, 12);
const MID_WAVE_PATH = makeWavePath(WAVE_TILE_WIDTH, 120, 12);
const FRONT_WAVE_PATH = makeWavePath(WAVE_TILE_WIDTH, 120, 24);

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export default function Bottle({
  currentMl,
  maxMl = DEFAULT_MAX_ML,
  className,
  animateOnMount = false,
  animationDurationMs = 2000,
  animationsEnabled = true,
}: BottleProps) {
  const rawId = useId();
  const clipId = `bottle-clip-${rawId.replace(/[:]/g, "")}`;

  const safeMaxMl = useMemo(() => {
    if (!Number.isFinite(maxMl) || maxMl <= 0) return DEFAULT_MAX_ML;
    return maxMl;
  }, [maxMl]);

  const safeTargetMl = useMemo(() => {
    const normalizedCurrentMl = Number.isFinite(currentMl) ? currentMl : 0;
    return clamp(normalizedCurrentMl, 0, safeMaxMl);
  }, [currentMl, safeMaxMl]);

  const shouldAnimateFill = animateOnMount && animationsEnabled;
  const [progress, setProgress] = useState(() => (shouldAnimateFill ? 0 : 1));

  useEffect(() => {
    if (!shouldAnimateFill) {
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
  }, [shouldAnimateFill, animationDurationMs]);

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
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Water bottle filled to ${Math.round(displayMl)} mL`}
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
        {hasWater && (
          <g transform={`translate(0 ${waveBaseY})`}>
            <g opacity="0.3">
              {animationsEnabled && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="0 0"
                  to={`${-WAVE_TILE_WIDTH} 0`}
                  dur="8s"
                  repeatCount="indefinite"
                />
              )}
              {[0, 1, 2].map((i) => (
                <path
                  key={`rear-${i}`}
                  d={REAR_WAVE_PATH}
                  transform={`translate(${i * WAVE_TILE_WIDTH} 0)`}
                  fill="rgba(40, 150, 255, 1)"
                />
              ))}
            </g>

            <g opacity="0.5">
              {animationsEnabled && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from={`${-WAVE_TILE_WIDTH} 0`}
                  to="0 0"
                  dur="5s"
                  repeatCount="indefinite"
                />
              )}
              {[0, 1, 2].map((i) => (
                <path
                  key={`mid-${i}`}
                  d={MID_WAVE_PATH}
                  transform={`translate(${i * WAVE_TILE_WIDTH} 0)`}
                  fill="rgba(120, 210, 255, 0.6)"
                />
              ))}
            </g>

            <g opacity="0.85">
              {animationsEnabled && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="0 0"
                  to={`${-WAVE_TILE_WIDTH} 0`}
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
              {[0, 1, 2].map((i) => (
                <path
                  key={`front-${i}`}
                  d={FRONT_WAVE_PATH}
                  transform={`translate(${i * WAVE_TILE_WIDTH} 0)`}
                  fill="rgba(84, 191, 255, 0.95)"
                />
              ))}
            </g>
          </g>
        )}
      </g>

      <text
        x={VIEW_WIDTH / 2}
        y={VIEW_HEIGHT - 1120}
        textAnchor="middle"
        fill="#2f6b98"
        fontSize="75"
        fontWeight="700"
      >
        USAGE TODAY
      </text>
      <text
        x={VIEW_WIDTH / 2}
        y={VIEW_HEIGHT - 960}
        textAnchor="middle"
        fill="#2f6b98"
        fontSize="150"
        fontWeight="700"
      >
        {Math.round(displayMl)} mL
      </text>
    </svg>
  );
}