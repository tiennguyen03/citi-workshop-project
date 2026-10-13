import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'

/** Light / dark switch. Renders nothing until the colour scheme is known (first paint). */
export default function ThemeModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme()
  if (!mode) return null
  const current = mode === 'system' ? systemMode : mode
  const next = current === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} mode`
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={() => setMode(next)}>
        {current === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}
