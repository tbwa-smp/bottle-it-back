import type { TrackerStats, WaterModelSettings } from "../utils/types";

type MonthlyViewProps = {
  stats: TrackerStats;
  settings: WaterModelSettings;
};

export default function MonthlyView({ stats }: MonthlyViewProps) {
  const sites = Object.values(stats.sites).sort((a, b) => b.waterMl - a.waterMl);

  return (
    <section>
      <h1>Monthly</h1>
      <p>Current tracker data by site:</p>

      <ul>
        {sites.length === 0 ? (
          <li>No tracked activity yet.</li>
        ) : (
          sites.map((site) => (
            <li key={site.siteKey}>
              {site.label}: {site.prompts} prompts · {site.waterMl.toFixed(2)} mL
            </li>
          ))
        )}
      </ul>
    </section>
  );
}