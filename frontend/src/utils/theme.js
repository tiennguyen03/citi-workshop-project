import { alpha } from '@mui/material/styles'

/**
 * Translucent tint of a palette colour that works with and without CSS theme variables
 * (tests render without the ThemeProvider). `color` is a palette key such as 'success'.
 */
export function tint(theme, color, opacity) {
  const channel = theme.vars?.palette?.[color]?.mainChannel
  if (channel) return `rgba(${channel} / ${opacity})`
  return alpha(theme.palette[color].main, opacity)
}

/** Palette colour reference usable in `sx` (CSS variable when available, hex otherwise). */
export function paletteColor(theme, color, shade = 'main') {
  return (theme.vars || theme).palette[color][shade]
}
