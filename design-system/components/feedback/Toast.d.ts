export interface ToastProps {
  open: boolean;
  onDismiss?: () => void;
  tone?: "neutral" | "success" | "danger";
  children: React.ReactNode;
  duration?: number;
}
