/**
 * @startingPoint section="Components" subtitle="Who else is watching this synced timer, live" viewport="700x140"
 */
export interface SyncBadgeProps {
  count: number;
  /** First-letter initials shown as small avatar dots, up to 4. */
  avatars?: string[];
  live?: boolean;
}
