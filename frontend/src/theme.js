import { createTheme } from '@mui/material/styles'

/** Application theme. Keep palette/typography decisions here, not in components. */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1f4e79' },
    secondary: { main: '#c77d00' },
    background: { default: '#f5f7fa' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
})

export default theme
