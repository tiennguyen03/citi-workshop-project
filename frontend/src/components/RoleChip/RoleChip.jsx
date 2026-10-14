import PropTypes from 'prop-types'
import Tag from '../Tag/Tag.jsx'
import { ROLE_LABELS } from '../../utils/roles.js'

const TONES = { admin: 'accent', manager: 'primary', employee: 'neutral' }

/**
 * Role label. Quiet by default (a role is a fact, not an alert) but the dot keeps the role's tone — indigo admin,
 * ink manager, grey employee — so a column of roles is still scannable. `variant="tinted"` for the odd emphasis.
 */
export default function RoleChip({ role, size = 'small', variant = 'quiet' }) {
  return <Tag size={size} tone={TONES[role] ?? 'neutral'} label={ROLE_LABELS[role] ?? role} variant={variant} />
}

RoleChip.propTypes = {
  role: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
  variant: PropTypes.oneOf(['tinted', 'quiet']),
}
