import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import useApi from '../../hooks/useApi.js'
import * as auditApi from '../../services/auditLog.js'
import { formatDateTime } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const PAGE_SIZE = 50
const ENTITY_TYPES = ['', 'user', 'project', 'milestone', 'goal', 'time_entry']
const EMPTY_FILTERS = { entityType: '', action: '', from: '', to: '' }

function DetailsCell({ entry }) {
  const [open, setOpen] = useState(false)
  if (!entry.details) return <Typography variant="body2">{entry.summary}</Typography>
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="body2">{entry.summary}</Typography>
        <IconButton size="small" aria-label={open ? 'Hide details' : 'Show details'} onClick={() => setOpen((o) => !o)}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Box component="pre" sx={{ m: 0, mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: 12, overflowX: 'auto' }}>
          {JSON.stringify(entry.details, null, 2)}
        </Box>
      </Collapse>
    </Box>
  )
}
DetailsCell.propTypes = {
  entry: PropTypes.shape({ summary: PropTypes.string.isRequired, details: PropTypes.object }).isRequired,
}

const COLUMNS = [
  {
    key: 'occurredAt',
    label: 'When',
    width: 200,
    render: (e) => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.occurredAt)}</span>,
  },
  {
    key: 'actor',
    label: 'Who',
    render: (e) =>
      e.actor ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <span>{fullName(e.actor)}</span>
          <RoleChip role={e.actorRole ?? e.actor.role} />
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          unknown
        </Typography>
      ),
  },
  { key: 'action', label: 'Action', render: (e) => <Chip size="small" label={e.action} variant="outlined" /> },
  { key: 'summary', label: 'What happened', render: (e) => <DetailsCell entry={e} /> },
  {
    key: 'statusCode',
    label: 'Result',
    align: 'right',
    render: (e) => <Chip size="small" label={e.statusCode} color={e.statusCode < 400 ? 'success' : 'error'} variant="outlined" />,
  },
]

/** Admin-only audit trail with filters and "load more" paging (ui-flow.md F11). */
export default function AuditLogPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [offset, setOffset] = useState(0)
  const [extra, setExtra] = useState([])

  const { data, loading, error, refetch } = useApi(
    () => auditApi.list({ ...applied, limit: PAGE_SIZE, offset: 0 }),
    [applied],
  )
  const rows = [...(data?.items ?? []), ...extra]
  const total = data?.total ?? 0
  const hasMore = rows.length < total

  function apply() {
    setExtra([])
    setOffset(0)
    setApplied(filters)
  }

  async function loadMore() {
    const nextOffset = offset + PAGE_SIZE
    const page = await auditApi.list({ ...applied, limit: PAGE_SIZE, offset: nextOffset })
    setExtra((prev) => [...prev, ...page.items])
    setOffset(nextOffset)
  }

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${total} recorded actions`} />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-end' } }}>
          <TextField
            select
            label="Entity"
            value={filters.entityType}
            onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            {ENTITY_TYPES.map((t) => (
              <MenuItem key={t || 'all'} value={t}>
                {t ? t.replace('_', ' ') : 'All'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Action"
            placeholder="e.g. project.archive"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value.trim() }))}
          />
          <TextField
            label="From"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={apply}>
              Apply
            </Button>
            <Button
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setExtra([])
                setOffset(0)
                setApplied(EMPTY_FILTERS)
              }}
            >
              Clear
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable columns={COLUMNS} rows={rows} getRowKey={(e) => e.id} loading={loading} emptyMessage="No actions match these filters." size="small" />
      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button onClick={loadMore}>Load more ({total - rows.length} remaining)</Button>
        </Box>
      )}
    </>
  )
}
