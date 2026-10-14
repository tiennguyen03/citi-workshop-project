import PropTypes from 'prop-types'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import SearchIcon from '@mui/icons-material/Search'

/** Search box plus any extra filter controls, sitting above a list. Never fetches; the page owns the state. */
export default function ListToolbar({ search, onSearchChange, placeholder = 'Search', children }) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="search"
          label="Search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', sm: 320 } }}
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
    </Paper>
  )
}

ListToolbar.propTypes = {
  search: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  children: PropTypes.node,
}
