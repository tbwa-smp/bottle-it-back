import { useState } from "react";

export default function Switch() {
  const [isOn, setIsOn] = useState(false);

  const toggle = () => {
    setIsOn(!isOn);
  };

  return (
    <button onClick={toggle} className={'switch ' + (isOn ? 'switch-on' : 'switch-off')}>

    </button>
  );
}