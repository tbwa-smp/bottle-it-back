import { useState } from "react";

const TIPS = [
    {
        title: "Say exactly what you want",
        body: `Skip the pleasantries.
“Give me 3 bullet points” 
works better than long intros.`,
    },
    {
        title: "Avoid long answers",
        body: `Say “one sentence”
or “keep it short.”`,
    },
    {
        title: "Only paste what you need",
        body: `Don’t send entire documents
if you only need one part.`,
    },
    {
        title: "Ask everything at once",
        body: `Combine questions in one prompt
instead of sending multiple.`,
    },
];

export default function TipsView() {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeTip = TIPS[activeIndex];

    return (
        <section
            className="tips-view"
            aria-label="Prompt tips"
            aria-roledescription="carousel"
        >
            <div className="tips-view__inner">
                <h1 className="tips-view__title">
                    PROMPT SMARTER,
                    <br />
                    USE LESS WATER
                </h1>

                <p className="tips-view__subtitle">A FEW TIPS:</p>

                <article className="tips-view__card" aria-live="polite">
                    <h2 className="tips-view__card-title">{activeTip.title}</h2>
                    <p className="tips-view__card-body">{activeTip.body}</p>
                </article>

                <div className="tips-view__dots" role="tablist" aria-label="Tip navigation">
                    {TIPS.map((tip, index) => {
                        const isActive = index === activeIndex;

                        return (
                            <button
                                key={tip.title}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-label={`Show tip ${index + 1}`}
                                className={
                                    isActive
                                        ? "tips-view__dot tips-view__dot--active"
                                        : "tips-view__dot"
                                }
                                onClick={() => setActiveIndex(index)}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
}