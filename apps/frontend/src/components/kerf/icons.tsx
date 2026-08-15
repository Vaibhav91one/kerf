// Kerf interface icons — exact path data exported from the Figma masters
// `Kerf/Asset/Icon/*` (page `Assets — Kerf`, 24px filled grid). Fills are
// currentColor so a caller sets the semantic role, per the Figma component
// note: "Use semantic color variables; do not recolor with raw hex values."
// Knockout shapes take var(--card) rather than white so they follow the
// surface they sit on in both themes.

type IconProps = { size?: number; className?: string };

export function AccountIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor"/>
<path d="M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z" fill="var(--card)"/>
<path d="M6.5 18.5C6.5 17.0413 7.07946 15.6424 8.11091 14.6109C9.14236 13.5795 10.5413 13 12 13C13.4587 13 14.8576 13.5795 15.8891 14.6109C16.9205 15.6424 17.5 17.0413 17.5 18.5V19H6.5V18.5Z" fill="var(--card)"/>
</g>
    </svg>
  );
}

export function HomeIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M12 2.69995L2.5 10.8V21H8.8V14.8H15.2V21H21.5V10.8L12 2.69995Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function InsightsIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M3 19H6V9H3V19ZM8 19H11V4H8V19ZM13 19H16V12H13V19ZM18 19H21V6H18V19Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function LiveIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M12 15.2C13.7673 15.2 15.2 13.7674 15.2 12C15.2 10.2327 13.7673 8.80005 12 8.80005C10.2327 8.80005 8.79999 10.2327 8.79999 12C8.79999 13.7674 10.2327 15.2 12 15.2Z" fill="currentColor"/>
<path d="M7.49999 6.09998C6.68152 6.84947 6.02794 7.76106 5.58081 8.77679C5.13368 9.79253 4.90277 10.8902 4.90277 12C4.90277 13.1098 5.13368 14.2074 5.58081 15.2232C6.02794 16.2389 6.68152 17.1505 7.49999 17.9L9.49999 15.9C8.94668 15.412 8.50353 14.8119 8.19999 14.1395C7.89645 13.467 7.73947 12.7377 7.73947 12C7.73947 11.2622 7.89645 10.5329 8.19999 9.8605C8.50353 9.18808 8.94668 8.58795 9.49999 8.09998L7.49999 6.09998ZM16.5 6.09998L14.5 8.09998C15.0533 8.58795 15.4965 9.18808 15.8 9.8605C16.1035 10.5329 16.2605 11.2622 16.2605 12C16.2605 12.7377 16.1035 13.467 15.8 14.1395C15.4965 14.8119 15.0533 15.412 14.5 15.9L16.5 17.9C17.3185 17.1505 17.972 16.2389 18.4192 15.2232C18.8663 14.2074 19.0972 13.1098 19.0972 12C19.0972 10.8902 18.8663 9.79253 18.4192 8.77679C17.972 7.76106 17.3185 6.84947 16.5 6.09998Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function KerfLogo({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <g transform="translate(6 5)">
<path d="M0 0H7V8L14 0H21L12 10L21 22H14L7 13V22H0V0Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function PeopleIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M8 11C9.06087 11 10.0783 10.5786 10.8284 9.82843C11.5786 9.07828 12 8.06087 12 7C12 5.93913 11.5786 4.92172 10.8284 4.17157C10.0783 3.42143 9.06087 3 8 3C6.93913 3 5.92172 3.42143 5.17157 4.17157C4.42143 4.92172 4 5.93913 4 7C4 8.06087 4.42143 9.07828 5.17157 9.82843C5.92172 10.5786 6.93913 11 8 11ZM16 10C16.394 10 16.7841 9.9224 17.1481 9.77164C17.512 9.62087 17.8427 9.3999 18.1213 9.12132C18.3999 8.84274 18.6209 8.51203 18.7716 8.14805C18.9224 7.78407 19 7.39397 19 7C19 6.60603 18.9224 6.21593 18.7716 5.85195C18.6209 5.48797 18.3999 5.15726 18.1213 4.87868C17.8427 4.6001 17.512 4.37913 17.1481 4.22836C16.7841 4.0776 16.394 4 16 4C15.2044 4 14.4413 4.31607 13.8787 4.87868C13.3161 5.44129 13 6.20435 13 7C13 7.79565 13.3161 8.55871 13.8787 9.12132C14.4413 9.68393 15.2044 10 16 10ZM1.5 20C1.5 18.2761 2.18482 16.6228 3.40381 15.4038C4.62279 14.1848 6.27609 13.5 8 13.5C9.72391 13.5 11.3772 14.1848 12.5962 15.4038C13.8152 16.6228 14.5 18.2761 14.5 20V21H1.5V20ZM15.3 21H22V20C22.0017 19.1503 21.7868 18.3141 21.3756 17.5705C20.9645 16.8269 20.3706 16.2003 19.65 15.75C18.9294 15.2996 18.106 15.0404 17.2574 14.9966C16.4088 14.9529 15.563 15.1261 14.8 15.5C15.2 16.4 15.3 17.4 15.3 18.5V21Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function ProjectsIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M3 5.2C3 4.61652 3.23179 4.05695 3.64437 3.64437C4.05695 3.23179 4.61652 3 5.2 3H10L12 5H18.8C19.3835 5 19.9431 5.23179 20.3556 5.64437C20.7682 6.05695 21 6.61652 21 7.2V16.8C21 17.3835 20.7682 17.9431 20.3556 18.3556C19.9431 18.7682 19.3835 19 18.8 19H5.2C4.61652 19 4.05695 18.7682 3.64437 18.3556C3.23179 17.9431 3 17.3835 3 16.8V5.2ZM5.4 8.4V16.6H18.6V8.4H5.4Z" fill="currentColor"/>
</g>
    </svg>
  );
}

// No Figma asset for this one (Rivals is new, not in the comps) — a plain
// pair of chevrons meeting head-on, same solid-fill/24x24 convention as the
// rest of this file, rather than reaching for a differently-styled icon set.
export function RivalsIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M4 4L11 11L4 18L2.5 16.5L8 11L2.5 5.5L4 4Z M20 4L13 11L20 18L21.5 16.5L16 11L21.5 5.5L20 4Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function SeasonIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M6 2H18V4H21V8C21 9.32608 20.4732 10.5979 19.5355 11.5355C18.5979 12.4732 17.3261 13 16 13H15.7C15.1461 13.8407 14.3895 14.5285 13.5 15V18H18V21H6V18H10.5V15C9.61049 14.5285 8.85393 13.8407 8.3 13H8C6.67392 13 5.40215 12.4732 4.46447 11.5355C3.52678 10.5979 3 9.32608 3 8V4H6V2ZM6 7H5V8C4.99811 8.6577 5.21241 9.2978 5.60991 9.82179C6.00742 10.3458 6.56611 10.7246 7.2 10.9C6.42157 9.74802 6.00382 8.39032 6 7ZM18 7C17.9962 8.39032 17.5784 9.74802 16.8 10.9C17.4339 10.7246 17.9926 10.3458 18.3901 9.82179C18.7876 9.2978 19.0019 8.6577 19 8V6H18V7Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function SkillsIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M21.6 18.4L14 10.8C14.411 9.64228 14.4855 8.39177 14.2148 7.19343C13.9442 5.99509 13.3394 4.89799 12.4707 4.0293C11.602 3.1606 10.5049 2.55587 9.3066 2.28521C8.10826 2.01454 6.85775 2.08902 5.70001 2.50001L9.70001 6.50001L6.50001 9.70001L2.50001 5.70001C2.08902 6.85775 2.01454 8.10826 2.28521 9.3066C2.55587 10.5049 3.1606 11.602 4.0293 12.4707C4.89799 13.3394 5.99509 13.9442 7.19343 14.2148C8.39177 14.4855 9.64228 14.411 10.8 14L18.4 21.6C18.8429 21.9064 19.3792 22.0476 19.9155 21.9991C20.4518 21.9507 20.9541 21.7156 21.3348 21.3348C21.7156 20.9541 21.9507 20.4518 21.9991 19.9155C22.0476 19.3792 21.9064 18.8429 21.6 18.4Z" fill="currentColor"/>
</g>
    </svg>
  );
}

export function TerminalIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g>
<path d="M3 4H21C21.5304 4 22.0391 4.21071 22.4142 4.58579C22.7893 4.96086 23 5.46957 23 6V18C23 18.5304 22.7893 19.0391 22.4142 19.4142C22.0391 19.7893 21.5304 20 21 20H3C2.46957 20 1.96086 19.7893 1.58579 19.4142C1.21071 19.0391 1 18.5304 1 18V6C1 5.46957 1.21071 4.96086 1.58579 4.58579C1.96086 4.21071 2.46957 4 3 4ZM5.2 8.2L8 11L5.2 13.8L6.8 15.4L11.2 11L6.8 6.6L5.2 8.2ZM12 16H18V14H12V16Z" fill="currentColor"/>
</g>
    </svg>
  );
}

// Copy and its success state. Not Figma masters — the comps draw a text button
// here, and these are the standard 24px marks for the two states, drawn on the
// same grid as the eleven above so they line up with them.
export function CopyIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CheckIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor" />
    </svg>
  );
}

// The GitHub mark. Not a Figma master — it is a third-party wordmark shape,
// reproduced here at the same 24px grid so a repo link reads as a repo link
// instead of printing a raw URL.
export function GithubIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.679.919.679 1.852 0 1.336-.012 2.415-.012 2.743 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
