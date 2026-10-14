import PropTypes from 'prop-types'
import Tag from '../Tag/Tag.jsx'
import { HEALTH } from '../../utils/projectHealth.js'

/** The one-word health of a project (D21). An unknown code shows as itself, in neutral, rather than breaking the page. */
export default function HealthTag({ health, size = 'small' }) {
  const entry = HEALTH[health]
  return <Tag label={entry?.label ?? health} tone={entry?.tone ?? 'neutral'} size={size} />
}

HealthTag.propTypes = {
  health: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
}
