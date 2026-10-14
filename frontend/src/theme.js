import { createTheme } from '@mui/material/styles'

/**
 * Application theme (context/coding-rules.md: palette/typography decisions live here, not in
 * components). Two faces with distinct jobs (decisions.md D20): IBM Plex Serif carries page titles
 * and headline figures — the hours and money the product is about — and Inter does everything else.
 * Neutrals are a real ink (blue-black), not a tinted #111. Small labels are sentence case, never
 * tracked capitals. 1px borders instead of shadows; light/dark via CSS variables.
 */
const FONT_FAMILY = ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'].join(',')
export const DISPLAY_FAMILY = ['"IBM Plex Serif"', 'Georgia', '"Times New Roman"', 'serif'].join(',')
const display = { fontFamily: DISPLAY_FAMILY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }

const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1C2538', light: '#3A4661', dark: '#0F1526', contrastText: '#FFFFFF' },
        secondary: { main: '#4F46E5', light: '#6366F1', dark: '#4338CA', contrastText: '#FFFFFF' },
        success: { main: '#16A34A', light: '#4ADE80', dark: '#15803D' },
        warning: { main: '#D97706', light: '#FBBF24', dark: '#B45309' },
        error: { main: '#DC2626', light: '#F87171', dark: '#B91C1C' },
        info: { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
        background: { default: '#F4F6FA', paper: '#FFFFFF' },
        text: { primary: '#1A2233', secondary: '#65708A', disabled: '#9AA3B5' },
        divider: '#E3E7EF',
        action: { hover: 'rgba(26, 34, 51, 0.04)', selected: 'rgba(26, 34, 51, 0.06)' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#EEF1F6', light: '#FFFFFF', dark: '#CBD2DF', contrastText: '#0B1220' },
        secondary: { main: '#818CF8', light: '#A5B4FC', dark: '#6366F1', contrastText: '#0B0D11' },
        success: { main: '#22C55E', light: '#4ADE80', dark: '#16A34A' },
        warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706' },
        error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
        info: { main: '#60A5FA', light: '#93C5FD', dark: '#3B82F6' },
        background: { default: '#0B1220', paper: '#121B2E' },
        text: { primary: '#EEF1F6', secondary: '#98A3B8', disabled: '#5C6980' },
        divider: '#25304A',
        action: { hover: 'rgba(238, 241, 246, 0.05)', selected: 'rgba(238, 241, 246, 0.08)' },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    h1: { ...display, fontSize: '2.25rem', letterSpacing: '-0.01em', lineHeight: 1.15 },
    h2: { ...display, fontSize: '1.875rem', letterSpacing: '-0.01em', lineHeight: 1.2 },
    h3: { ...display, fontSize: '1.625rem', letterSpacing: '-0.005em', lineHeight: 1.25 },
    h4: { ...display, fontSize: '1.5rem', lineHeight: 1.25 },
    h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5 },
    // "overline" is the small label above a value or a field. Sentence case on purpose: tracked capitals
    // are the commonest tell of a templated page and are the least legible text on it.
    overline: { fontSize: '0.75rem', fontWeight: 500, letterSpacing: 0, lineHeight: 1.5, textTransform: 'none' },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
        '*:focus-visible': { outlineOffset: 2 },
      },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 14, minHeight: 36 },
        sizeSmall: { minHeight: 30, paddingInline: 10 },
        sizeLarge: { minHeight: 44, fontSize: '0.9375rem' },
        outlined: ({ theme: t }) => ({ borderColor: t.vars.palette.divider, '&:hover': { borderColor: t.vars.palette.text.secondary } }),
        text: { paddingInline: 10 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 8,
          backgroundColor: t.vars.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: t.vars.palette.divider },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.vars.palette.text.secondary },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1 },
        }),
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2 } } },
    MuiTableContainer: { styleOverrides: { root: { overflowX: 'auto' } } },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme: t }) => ({ borderBottomColor: t.vars.palette.divider, padding: '14px 16px' }),
        head: ({ theme: t }) => ({
          fontSize: '0.75rem',
          fontWeight: 500,
          letterSpacing: 0,
          textTransform: 'none',
          color: t.vars.palette.text.secondary,
          backgroundColor: t.vars.palette.background.default,
          borderBottomColor: t.vars.palette.divider,
          whiteSpace: 'nowrap',
        }),
        sizeSmall: { padding: '10px 16px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          '&:last-child td': { borderBottom: 0 },
          '&.MuiTableRow-hover:hover': { backgroundColor: t.vars.palette.action.hover },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500 },
        sizeSmall: { height: 22, fontSize: '0.75rem' },
        labelSmall: { paddingInline: 8 },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: ({ theme: t }) => ({ minHeight: 40, borderBottom: `1px solid ${t.vars.palette.divider}` }),
        indicator: { height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          minHeight: 40,
          paddingInline: 4,
          marginRight: 20,
          fontWeight: 500,
          color: t.vars.palette.text.secondary,
          '&.Mui-selected': { color: t.vars.palette.text.primary },
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          borderRadius: 14,
          border: `1px solid ${t.vars.palette.divider}`,
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.25)',
        }),
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.0625rem', fontWeight: 600, padding: '20px 24px 8px' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '8px 24px 20px' } } },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          border: `1px solid ${t.vars.palette.divider}`,
          boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.18)',
          marginTop: 4,
        }),
      },
    },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: 6, marginInline: 6, paddingBlock: 6, fontSize: '0.875rem' } } },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 8,
          paddingBlock: 7,
          paddingInline: 10,
          color: t.vars.palette.text.secondary,
          '& .MuiListItemIcon-root': { minWidth: 32, color: 'inherit' },
          '& .MuiSvgIcon-root': { fontSize: 20 },
          '&:hover': { color: t.vars.palette.text.primary },
          '&.active': {
            color: t.vars.palette.text.primary,
            backgroundColor: t.vars.palette.action.selected,
            '& .MuiListItemText-primary': { fontWeight: 600 },
          },
        }),
      },
    },
    MuiListItemText: { styleOverrides: { primary: { fontSize: '0.875rem', fontWeight: 500 } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, alignItems: 'center' },
        standard: ({ theme: t }) => ({ border: `1px solid ${t.vars.palette.divider}` }),
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: ({ theme: t }) => ({ height: 6, borderRadius: 3, backgroundColor: t.vars.palette.action.selected }),
        bar: { borderRadius: 3 },
      },
    },
    MuiSkeleton: { defaultProps: { animation: 'wave' }, styleOverrides: { rounded: { borderRadius: 10 } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 6, fontSize: '0.75rem', fontWeight: 500 } } },
    MuiDivider: { styleOverrides: { root: ({ theme: t }) => ({ borderColor: t.vars.palette.divider }) } },
    MuiAvatar: { styleOverrides: { root: { fontWeight: 600, fontSize: '0.8125rem' } } },
    MuiFormControlLabel: { styleOverrides: { label: { fontSize: '0.875rem' } } },
  },
})

export default theme
