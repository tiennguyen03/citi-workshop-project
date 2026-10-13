import PropTypes from 'prop-types'
import Tag from '../Tag/Tag.jsx'
import { ROLE_LABELS } from '../../utils/roles.js'

const TONES = { admin: 'accent', manager: 'primary', employee: 'neutral' }

/** Small role badge. */
export default function RoleChip({ role, size = 'small' }) {
  return <Tag size={size} tone={TONES[role] ?? 'neutral'} label={ROLE_LABELS[role] ?? role} />
}

RoleChip.propTypes = {
  role: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
}
