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

const WAVE_PATH =
  "M0 120 C58 40 116 200 174 120 S290 40 348 120 S464 200 522 120 S639 40 697 120 V420 H0 Z";

export default function Bottle({
  currentMl,
  maxMl = DEFAULT_MAX_ML,
  className,
  animateOnMount = false,
  animationDurationMs = 1400,
}: BottleProps) {
  const rawId = useId();
  const clipId = `bottle-clip-${rawId.replace(/[:]/g, "")}`;

  const safeTargetMl = useMemo(
    () => Math.max(0, Math.min(currentMl, maxMl)),
    [currentMl, maxMl],
  );

  const [progress, setProgress] = useState(() => (animateOnMount ? 0 : 1));

  useEffect(() => {
    if (!animateOnMount) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const linear = Math.min(elapsed / animationDurationMs, 1);
      const eased = 1 - Math.pow(1 - linear, 3); // easeOutCubic

      setProgress(eased);

      if (linear < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [animateOnMount, animationDurationMs]);

  const displayMl = safeTargetMl * progress;
  const isAnimating = animateOnMount && progress < 1;

  const fillRatio = maxMl === 0 ? 0 : displayMl / maxMl;
  const fillHeight = VIEW_HEIGHT * fillRatio;
  const fillY = VIEW_HEIGHT - fillHeight;
  const waveBaseY = fillY - 120;

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={`Water bottle filled to ${displayMl.toFixed(2)} milliliters out of ${maxMl} milliliters`}
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
          fill="rgba(64, 182, 255, 0.65)"
        />

        <g transform={`translate(0 ${waveBaseY})`}>
          {isAnimating ? (
            <g opacity="0.75">
              <animateTransform
                attributeName="transform"
                type="translate"
                from={`-${VIEW_WIDTH / 2} 0`}
                to={`-${VIEW_WIDTH * 1.5} 0`}
                dur="1.6s"
                repeatCount="indefinite"
              />
              <path d={WAVE_PATH} fill="rgba(110, 210, 255, 0.8)" />
              <path
                d={WAVE_PATH}
                transform={`translate(${VIEW_WIDTH} 0)`}
                fill="rgba(110, 210, 255, 0.8)"
              />
              <path
                d={WAVE_PATH}
                transform={`translate(${VIEW_WIDTH * 2} 0)`}
                fill="rgba(110, 210, 255, 0.8)"
              />
            </g>
          ) : (
            <path d={WAVE_PATH} fill="rgba(110, 210, 255, 0.8)" />
          )}
        </g>
      </g>

      <text
        x={VIEW_WIDTH / 2}
        y={VIEW_HEIGHT - 165}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="110"
        fontWeight="700"
      >
        {displayMl.toFixed(2)} mL
      </text>
    </svg>
  );
}