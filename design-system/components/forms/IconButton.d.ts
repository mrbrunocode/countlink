export type IconButtonVariant = "ghost" | "outline" | "solid";

export interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: IconButtonVariant;
  active?: boolean;
  onClick?: () => void;
}
