import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as auditApi from '../../services/auditLog.js'
import * as usersApi from '../../services/users.js'
import { actionLabel } from '../../utils/auditActions.js'
import { formatDateTime } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const PAGE_SIZE = 50
const ENTITY_TYPES = ['', 'user', 'project', 'milestone', 'goal', 'time_entry']
/** Applied filters live in the URL (`/audit-log?actorId=…` is linked from a user's page); the form holds a draft. */
const FILTER_DEFAULTS = { entityType: '', action: '', actorId: '', from: '', to: '' }

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
        <Box component="pre" sx={{ m: 0, mt: 1, p: 1.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 2, fontSize: 12, overflowX: 'auto' }}>
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
    nowrap: true,
    render: (e) => formatDateTime(e.occurredAt),
  },
  {
    key: 'actor',
    label: 'Who',
    nowrap: true,
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
  {
    key: 'action',
    label: 'Action',
    nowrap: true,
    render: (e) => (
      <Box>
        <Typography variant="body2">{actionLabel(e.action)}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {e.action}
        </Typography>
      </Box>
    ),
  },
  { key: 'summary', label: 'What happened', render: (e) => <DetailsCell entry={e} /> },
  {
    key: 'statusCode',
    label: 'Result',
    align: 'right',
    render: (e) => <Tag label={e.statusCode} tone={e.statusCode < 400 ? 'success' : 'error'} />,
  },
]

/** Admin-only audit trail with filters and "load more" paging (ui-flow.md F11). */
export default function AuditLogPage() {
  const { filters: applied, setFilters: applyToUrl } = useUrlFilters(FILTER_DEFAULTS)
  const [filters, setFilters] = useState(applied)
  const [offset, setOffset] = useState(0)
  const [extra, setExtra] = useState([])

  const { data, loading, error, refetch } = useApi(
    () => auditApi.list({ ...applied, limit: PAGE_SIZE, offset: 0 }),
    [applied],
  )
  const { data: actionsData } = useApi(() => auditApi.actions(), [])
  const { data: peopleData } = useApi(() => usersApi.list(), [])
  const actions = actionsData?.items ?? []
  const people = peopleData?.items ?? []
  const rows = [...(data?.items ?? []), ...extra]
  const total = data?.total ?? 0
  const hasMore = rows.length < total

  function commit(next) {
    setExtra([])
    setOffset(0)
    applyToUrl(next)
  }
  const apply = () => commit(filters)
  const select = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

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
          <TextField select label="Entity" value={filters.entityType} onChange={(e) => select('entityType', e.target.value)} sx={{ minWidth: 150 }}>
            {ENTITY_TYPES.map((t) => (
              <MenuItem key={t || 'all'} value={t}>
                {t ? t.replace('_', ' ') : 'All'}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Action" value={filters.action} onChange={(e) => select('action', e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">All actions</MenuItem>
            {actions.map((a) => (
              <MenuItem key={a} value={a}>
                <Box>
                  <Typography variant="body2">{actionLabel(a)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {a}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Actor" value={filters.actorId} onChange={(e) => select('actorId', e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">Anyone</MenuItem>
            {people.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {fullName(p)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="From" type="date" value={filters.from} onChange={(e) => select('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" value={filters.to} onChange={(e) => select('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={apply}>
              Apply
            </Button>
            <Button
              onClick={() => {
                setFilters(FILTER_DEFAULTS)
                commit(FILTER_DEFAULTS)
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
