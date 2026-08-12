import { useEffect, useRef, type ReactNode } from "react";
import "../App.css";
import { BulbIcon, CalendarIcon, ClockIcon } from "../views/InfoView";

export type TabKey = "usage" | "monthly" | "tips";

type TabsProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  hideIndicator?: boolean;
};

const TAB_ORDER: TabKey[] = ["usage", "monthly", "tips"];

const TAB_META: Record<TabKey, { icon: ReactNode; label: string }> = {
  monthly: { icon: <CalendarIcon />, label: "Monthly" },
  usage: { icon: <ClockIcon />, label: "Usage Today" },
  tips: { icon: <BulbIcon />, label: "Tips" },
};

export default function Tabs({
  activeTab,
  onChange,
  hideIndicator = false,
}: TabsProps) {
  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const previousIndexRef = useRef(activeIndex);

  const previousIndex = previousIndexRef.current;
  const direction =
    activeIndex > previousIndex
      ? "right"
      : activeIndex < previousIndex
        ? "left"
        : "none";

  useEffect(() => {
    previousIndexRef.current = activeIndex;
  }, [activeIndex]);

  return (
    <section
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        padding: "12px",
        boxSizing: "border-box",
      }}
    >
      <svg
        className="tabs-filter-defs"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="liquidGlassTabs"
            x="-20%"
            y="-60%"
            width="140%"
            height="220%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.06"
              numOctaves="1"
              seed="7"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="0.35" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="softNoise"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feGaussianBlur
              in="displaced"
              stdDeviation="0.55"
              result="blurred"
            />
            <feColorMatrix
              in="blurred"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 18 -7
              "
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" mode="screen" />
          </filter>
        </defs>
      </svg>

      <nav className="tabs" aria-label="Main views">
        {!hideIndicator && (
          <div
            className="tabs__indicator"
            style={{
              transform: `translateX(${activeIndex * 100}%)`,
            }}
            aria-hidden="true"
          >
            <div
              key={`${activeTab}-${direction}`}
              className={[
                "tabs__indicator-pill",
                direction !== "none" ? "is-moving" : "",
                direction === "right" ? "from-left" : "",
                direction === "left" ? "from-right" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          </div>
        )}

        {TAB_ORDER.map((tab) => {
          const isActive = !hideIndicator && activeTab === tab;
          const meta = TAB_META[tab];

          return (
            <button
              key={tab}
              type="button"
              className={isActive ? "tabs__button is-active" : "tabs__button"}
              onClick={() => onChange(tab)}
              aria-pressed={isActive}
              aria-label={meta.label}
              title={meta.label}
            >
              {meta.icon}
            </button>
          );
        })}
      </nav>
    </section>
  );
}