import PropTypes from 'prop-types'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

/**
 * An icon-only action in a row or list (D25): always a tooltip, always an accessible label, the same muted resting
 * colour, ink on hover (or red for a `danger` action), and the theme's focus ring. `label` is the tooltip; pass
 * `aria-label` for the specific name a screen reader should get ("Release Daniel Kim"), else the label is used.
 */
export default function ActionIconButton({ label, 'aria-label': ariaLabel, danger = false, onClick, children, disabled = false }) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation() // rows are often clickable; the icon is its own action
            onClick(e)
          }}
          sx={{ color: 'text.secondary', '&:hover': { color: danger ? 'error.main' : 'text.primary', bgcolor: 'action.hover' } }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

ActionIconButton.propTypes = {
  label: PropTypes.string.isRequired,
  'aria-label': PropTypes.string,
  danger: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
}
