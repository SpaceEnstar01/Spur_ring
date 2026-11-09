export function SpurPulse({
  state = 'idle',
  small = false,
}: {
  state?: string
  small?: boolean
}) {
  return (
    <span
      className={`spur-pulse pulse-${state} ${small ? 'pulse-small' : ''}`}
      aria-hidden="true"
    >
      <span />
      <i />
    </span>
  )
}
