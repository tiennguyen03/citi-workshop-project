import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import useApi from '../../hooks/useApi.js'
import useAuth from '../../auth/useAuth.js'
import * as timeEntriesApi from '../../services/timeEntries.js'
import { formatDate, formatHours } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'
import { sumHours } from '../../utils/timeEntryForm.js'
import TimeEntryDialog from './TimeEntryDialog.jsx'

/** Logged time for a project: members see their own entries, managers/admins everyone's (ui-flow.md F6/F7). */
export default function TimeTab({ project, canManage, onChanged, notify }) {
  const { user: me } = useAuth()
  const [userId, setUserId] = useState('')
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pending, setPending] = useState(false)

  const writable = !project.archived && project.status === 'active'
  const canLog = writable && project.myMembership?.isActive === true

  const { data, loading, error, refetch } = useApi(
    () => timeEntriesApi.list(project.id, { userId: userId || undefined }),
    [project.id, userId],
  )
  const rows = data?.items ?? []
  const people = canManage ? [...new Map(rows.map((e) => [e.user.id, e.user])).values()] : []

  const changed = () => {
    refetch()
    onChanged()
  }

  async function confirmDelete() {
    setPending(true)
    try {
      await timeEntriesApi.remove(deleting.id)
      notify('Time entry deleted')
      setDeleting(null)
      changed()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setPending(false)
    }
  }

  const columns = [
    { key: 'entryDate', label: 'Date', nowrap: true, render: (e) => formatDate(e.entryDate), width: 140 },
    ...(canManage ? [{ key: 'user', label: 'Person', render: (e) => fullName(e.user) }] : []),
    { key: 'hours', label: 'Hours', align: 'right', render: (e) => formatHours(e.hours), width: 100 },
    { key: 'note', label: 'Note', render: (e) => e.note || <Typography variant="caption" color="text.secondary">—</Typography> },
    ...(writable
      ? [
          {
            key: 'actions',
            label: '',
            align: 'right',
            width: 96,
            render: (e) => {
              const mine = e.user.id === me.id
              if (!mine && !canManage) return null
              return (
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                  {mine && (
                    <Tooltip title="Edit entry">
                      <IconButton size="small" aria-label={`Edit entry on ${formatDate(e.entryDate)}`} onClick={() => setEditing(e)} sx={{ color: 'text.secondary' }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete entry">
                    <IconButton
                      size="small"
                      aria-label={`Delete entry on ${formatDate(e.entryDate)}`}
                      onClick={() => setDeleting(e)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        {canManage ? (
          <TextField select label="Person" value={userId} onChange={(e) => setUserId(e.target.value)} sx={{ width: 220 }}>
            <MenuItem value="">Everyone</MenuItem>
            {people.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {fullName(p)}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {canLog ? 'Your logged time on this project.' : 'Your logged time on this project (read-only).'}
          </Typography>
        )}
        {canLog && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogging(true)}>
            Log time
          </Button>
        )}
      </Stack>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, mb: 2 }}>
        <StatCard label="Hours logged" value={formatHours(sumHours(rows))} hint={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${canManage && userId ? ' for this person' : ''}`} />
        {!canManage && project.myMembership && (
          <StatCard label="Assigned to you" value={formatHours(project.myMembership.hoursAssigned)} hint={`${formatHours(project.myMembership.hoursCompleted)} completed`} />
        )}
        {canManage && <StatCard label="Project total" value={formatHours(project.hoursCompleted)} hint={`of ${formatHours(project.capacityHours)} capacity`} />}
      </Box>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => e.id}
        loading={loading}
        emptyMessage={canLog ? 'Nothing logged yet. Use "Log time" to add your first entry.' : 'No time logged yet.'}
        size="small"
      />
      {canLog && (
        <TimeEntryDialog
          key={`log-${logging}`}
          open={logging}
          project={project}
          onClose={() => setLogging(false)}
          onSaved={(saved) => {
            setLogging(false)
            notify(`Logged ${formatHours(saved.hours)}`)
            changed()
          }}
        />
      )}
      {editing && (
        <TimeEntryDialog
          open
          project={project}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            notify('Time entry updated')
            changed()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete time entry?"
        message={deleting ? `${formatHours(deleting.hours)} on ${formatDate(deleting.entryDate)} will be removed and hours completed will go down.` : ''}
        confirmLabel="Delete"
        confirmColor="error"
        pending={pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

TimeTab.propTypes = {
  project: PropTypes.object.isRequired,
  canManage: PropTypes.bool.isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
