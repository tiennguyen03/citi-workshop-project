import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DataTable from '../../components/DataTable/DataTable.jsx'
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/DataTable/paging.js'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import TitleCell from '../../components/TitleCell/TitleCell.jsx'
import useApi from '../../hooks/useApi.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as auditApi from '../../services/auditLog.js'
import * as usersApi from '../../services/users.js'
import { actionLabel } from '../../utils/auditActions.js'
import { formatDateTime } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const ENTITY_TYPES = ['', 'user', 'project', 'milestone', 'goal', 'time_entry']
/** Applied filters live in the URL (`/audit-log?actorId=…` is linked from a user's page); the form holds a draft. */
const FILTER_DEFAULTS = { entityType: '', action: '', actorId: '', from: '', to: '', page: '1', size: String(PAGE_SIZE) }
const { page: _defaultPage, size: _defaultSize, ...appliedDefaults } = FILTER_DEFAULTS

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

/**
 * One treatment for an HTTP result (D25): the code as quiet text with its semantic dot — green 2xx, amber 3xx, red 4xx —
 * and a tinted tag only for a 5xx, the one result that means the system itself failed.
 */
function ResultCode({ code }) {
  const tone = code >= 400 ? 'error' : code >= 300 ? 'warning' : 'success'
  return <Tag label={code} tone={tone} variant={code >= 500 ? 'tinted' : 'quiet'} />
}
ResultCode.propTypes = { code: PropTypes.number.isRequired }

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
    render: (e) => <TitleCell title={actionLabel(e.action)} caption={e.action} />,
  },
  { key: 'summary', label: 'What happened', render: (e) => <DetailsCell entry={e} /> },
  {
    key: 'statusCode',
    label: 'Result',
    numeric: true,
    render: (e) => <ResultCode code={e.statusCode} />,
  },
]

/** Admin-only audit trail with filters and paging, all in the URL (ui-flow.md F11). */
export default function AuditLogPage() {
  const { filters: applied, setFilters: applyToUrl } = useUrlFilters(FILTER_DEFAULTS)
  const { page: pageParam, size: sizeParam, ...appliedFilters } = applied
  const page = Math.max(1, Number(pageParam) || 1)
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sizeParam)) ? Number(sizeParam) : PAGE_SIZE
  const [filters, setFilters] = useState(appliedFilters)

  const { data, loading, error, refetch } = useApi(
    () => auditApi.list({ ...appliedFilters, limit: pageSize, offset: (page - 1) * pageSize }),
    [appliedFilters, page, pageSize],
  )
  const { data: actionsData } = useApi(() => auditApi.actions(), [])
  const { data: peopleData } = useApi(() => usersApi.list({ inactive: 'true', limit: 100 }), [])
  const actions = actionsData?.items ?? []
  const people = peopleData?.items ?? []
  const rows = data?.items ?? []
  const total = data?.total ?? 0

  const commit = (next) => applyToUrl({ ...next, page: '' })
  const apply = () => commit(filters)
  const select = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${total} recorded actions`} />
      {/* a compact group of controls, not a band across the page (D25) */}
      <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2, '& .MuiTextField-root': { width: { xs: '100%', sm: 'auto' } } }}>
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
                setFilters(appliedDefaults)
                commit(appliedDefaults)
              }}
            >
              Clear
            </Button>
          </Stack>
      </Stack>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(e) => e.id}
        loading={loading}
        emptyMessage="No actions match these filters."
        size="small"
        pagination={{
          page: page - 1,
          pageSize,
          total,
          onPageChange: (p) => applyToUrl({ page: String(p + 1) }),
          onPageSizeChange: (size) => applyToUrl({ size: String(size), page: '' }),
        }}
      />
    </>
  )
}
