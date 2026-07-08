/**
 * The product's signature surface: a large synced count. Every user viewing
 * the same link sees the exact same number, so it must read instantly and
 * unambiguously at a distance.
 *
 * @startingPoint section="Components" subtitle="The synced count itself — 4 sizes, count up/down" viewport="700x340"
 */
export interface TimerDisplayProps {
  /** Signed seconds remaining (negative once past zero, if counting up is allowed). */
  totalSeconds: number;
  size?: "sm" | "md" | "lg" | "xl";
  direction?: "down" | "up";
  /** Small caption below the number, e.g. "UNTIL LAUNCH". */
  label?: string;
}
