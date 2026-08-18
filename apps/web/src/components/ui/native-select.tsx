import { cn } from "@/lib/utils";

export interface NativeSelectOption {
  value: string;
  label: string;
}

/**
 * Plain <select>, not shadcn/base-ui's Select. @base-ui/react 1.7.0's
 * Select.Root instances interfere with each other when more than one is
 * mounted on the page — opening a second select silently clears the
 * first one's already-made choice (reproduced consistently: staff-type +
 * designation on the Employee form, program + term on the Section form).
 * Every form here needs 2+ selects at once, so this sidesteps the bug
 * rather than working around it per-form.
 */
export function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: NativeSelectOption[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "border-input bg-transparent focus-visible:ring-ring/50 dark:bg-input/30 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
