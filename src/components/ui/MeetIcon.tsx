/**
 * The Google Meet icon (owner, 30 October 2026): the same art as the Clinica
 * Sentido agenda, so both tools show a call the same way. Ring in Google's
 * four colours, white middle, black camera. The shadow is CSS, not in the
 * SVG, so it follows whatever it sits on.
 */
export function MeetIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} className={className}
      role="img" aria-label="Google Meet"
      style={{ filter: 'drop-shadow(0 2px 5px rgba(31,47,71,.2))' }}>
      <path d="M14 14L14 0A14 14 0 0 1 28 14Z" fill="#EA4335" />
      <path d="M14 14L28 14A14 14 0 0 1 14 28Z" fill="#FBBC04" />
      <path d="M14 14L14 28A14 14 0 0 1 0 14Z" fill="#34A853" />
      <path d="M14 14L0 14A14 14 0 0 1 14 0Z" fill="#4285F4" />
      <circle cx="14" cy="14" r="10" fill="#fff" />
      <g transform="translate(5.5 5.5) scale(0.53125)">
        <path d="M5 11.5C5 9.6 6.6 8 8.5 8H17.5C19.4 8 21 9.6 21 11.5v9c0 1.9-1.6 3.5-3.5 3.5H8.5C6.6 24 5 22.4 5 20.5V11.5Z" fill="#202124" />
        <path d="M21 13.2l6-4.4v14.4l-6-4.4v-5.6Z" fill="#202124" />
      </g>
    </svg>
  )
}
