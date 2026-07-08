export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

/**
 * @startingPoint section="Components" subtitle="Status pill with optional live-pulsing dot" viewport="700x160"
 */
export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}
