export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * @startingPoint section="Components" subtitle="Primary action button, 4 variants x 3 sizes" viewport="700x260"
 */
export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}
