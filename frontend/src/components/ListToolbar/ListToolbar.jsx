import PropTypes from 'prop-types'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import SearchIcon from '@mui/icons-material/Search'

/**
 * Search box plus any extra filter controls, sitting above a list. Never fetches; the page owns the state.
 * A compact row (D25), not a bordered band across the page: two or three controls should not own the whole width.
 * Children share the search box's 40 px height; wrap toggles in `FormControlLabel` and they line up.
 */
export default function ListToolbar({ search, onSearchChange, placeholder = 'Search', children }) {
  return (
    <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2, '& .MuiFormControlLabel-root': { ml: 0, mr: 0 } }}>
      <TextField
        type="search"
        label="Search"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        size="small"
        sx={{ width: { xs: '100%', sm: 280 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {children}
    </Stack>
  )
}

ListToolbar.propTypes = {
  search: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  children: PropTypes.node,
}
