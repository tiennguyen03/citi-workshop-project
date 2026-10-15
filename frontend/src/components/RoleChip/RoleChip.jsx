import PropTypes from 'prop-types'
import Tag from '../Tag/Tag.jsx'
import { ROLE_LABELS } from '../../utils/roles.js'

const TONES = { admin: 'accent', manager: 'info', employee: 'neutral' }

/**
 * Role label. Quiet by default (a role is a fact, not an alert); the text is full contrast for every role and only
 * the dot differs — purple admin, blue manager, blue-grey employee (D25) — so a column of roles is still scannable. `variant="tinted"` for the odd emphasis.
 */
export default function RoleChip({ role, size = 'small', variant = 'quiet' }) {
  return <Tag size={size} tone={TONES[role] ?? 'neutral'} label={ROLE_LABELS[role] ?? role} variant={variant} />
}

RoleChip.propTypes = {
  role: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
  variant: PropTypes.oneOf(['tinted', 'quiet']),
}
