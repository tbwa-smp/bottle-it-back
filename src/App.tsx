import { useEffect, useState } from "react";
import Bottle from "./components/Bottle";
import logo from "./assets/logo.svg"
import "./App.css"

const ML_PER_PROMPT = 0.38;
const MAX_ML = 500;

export default function App() {
  const [promptCount, setPromptCount] = useState(0);
  const [animateBottle, setAnimateBottle] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ["promptCount", "hasSeenBottleAnimation"],
      (result) => {
        const savedPromptCount = Number(result.promptCount ?? 0);
        const hasSeenBottleAnimation = Boolean(result.hasSeenBottleAnimation);

        setPromptCount(savedPromptCount);
        setAnimateBottle(!hasSeenBottleAnimation);
        setReady(true);

        if (!hasSeenBottleAnimation) {
          chrome.storage.local.set({ hasSeenBottleAnimation: true });
        }
      },
    );
  }, []);

  if (!ready) return null;

  const currentMl = Math.min(promptCount * ML_PER_PROMPT, MAX_ML);

  return (
    <main>
      <header>
        <img src={logo} alt="logo" style={{ width: "50px" }}/>
      </header>
      <Bottle
        currentMl={currentMl}
        animateOnMount={animateBottle}
        className="bottle"
      />
    </main>
  );
}