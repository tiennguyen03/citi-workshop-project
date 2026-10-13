import PropTypes from 'prop-types'
import Chip from '@mui/material/Chip'
import { ROLE_LABELS } from '../../utils/roles.js'

const COLORS = { admin: 'secondary', manager: 'primary', employee: 'default' }

/** Small coloured role badge. */
export default function RoleChip({ role, size = 'small' }) {
  return <Chip size={size} color={COLORS[role] ?? 'default'} label={ROLE_LABELS[role] ?? role} />
}

RoleChip.propTypes = {
  role: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
}
