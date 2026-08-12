type TrackingSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  disabled?: boolean;
};

export default function TrackingSwitch({
  checked,
  onChange,
  disabled = false,
}: TrackingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Toggle AI tracking"
      disabled={disabled}
      onClick={() => void onChange(!checked)}
      className={`tracking-switch ${checked ? 'is-on' : 'is-off'}`}
    >
      <span className="tracking-switch__track">
        <span className="tracking-switch__thumb" />
      </span>
    </button>
  );
}