import PropTypes from 'prop-types'
import Tag from '../Tag/Tag.jsx'
import { dueStatus } from '../../utils/dates.js'

/**
 * Urgency cue for a due date: red when it has passed, amber when it is within `soonDays`,
 * nothing otherwise. Renders nothing when `isOpen` is false (a finished thing is never overdue).
 * Pass `soonDays={null}` to show only the overdue state (e.g. a project past its end date).
 * `variant="quiet"` renders the cue as dot + text for places where a stronger signal already carries the urgency.
 */
export default function DueTag({ dueDate, isOpen = true, soonDays = 7, overdueLabel = 'Overdue', overdueTone = 'error', size = 'small', variant = 'tinted' }) {
  if (!isOpen) return null
  const { kind, days } = dueStatus(dueDate, { soonDays })
  if (kind === 'overdue') return <Tag label={overdueLabel} tone={overdueTone} size={size} variant={variant} />
  if (kind === 'due_soon') {
    const label = days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`
    return <Tag label={label} tone="warning" size={size} variant={variant} />
  }
  return null
}

DueTag.propTypes = {
  dueDate: PropTypes.string,
  isOpen: PropTypes.bool,
  soonDays: PropTypes.number,
  overdueLabel: PropTypes.node,
  overdueTone: PropTypes.oneOf(['error', 'warning']),
  size: PropTypes.oneOf(['small', 'medium']),
  variant: PropTypes.oneOf(['tinted', 'quiet']), // quiet = supporting text under a stronger signal (D25)
}
