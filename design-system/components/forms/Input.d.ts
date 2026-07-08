/**
 * @startingPoint section="Components" subtitle="Text input with label, helper text, error state" viewport="700x220"
 */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}
