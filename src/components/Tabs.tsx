import { useEffect, useRef } from "react";
import "../App.css";

// Assets
import todayIcon from "../assets/today.png";
import calendarIcon from "../assets/calendar.png";
import tipsIcon from "../assets/tips.png";

export type TabKey = "usage" | "monthly" | "tips";

type TabsProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

const TAB_ORDER: TabKey[] = ["usage", "monthly", "tips"];

const TAB_META: Record<TabKey, { icon: string; label: string }> = {
  usage: { icon: todayIcon, label: "Usage Today" },
  monthly: { icon: calendarIcon, label: "Monthly" },
  tips: { icon: tipsIcon, label: "Tips" }
};

export default function Tabs({ activeTab, onChange }: TabsProps) {
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
        padding: "24px",
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
            <feGaussianBlur in="displaced" stdDeviation="0.55" result="blurred" />
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

        {TAB_ORDER.map((tab) => {
          const isActive = activeTab === tab;
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
              <img src={meta.icon} alt="" aria-hidden="true" className="tabs__emoji" />
            </button>
          );
        })}
      </nav>
    </section>
  );
}