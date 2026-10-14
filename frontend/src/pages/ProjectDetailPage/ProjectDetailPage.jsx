import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { formatDate } from '../../utils/format.js'
import { ROLES, fullName } from '../../utils/roles.js'
import MembersTab from './MembersTab.jsx'
import MilestonesTab from './MilestonesTab.jsx'
import OverviewTab from './OverviewTab.jsx'
import TimeTab from './TimeTab.jsx'
import ProjectEditDialog from './ProjectEditDialog.jsx'

const TABS = ['overview', 'members', 'milestones', 'time']

/** Project detail with Overview, Members, Milestones and Time tabs. The tab lives in `?tab=` so it can be linked to. */
export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { notice, notify, clear } = useNotice()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'overview') next.delete('tab')
        else next.set('tab', value)
        return next
      },
      { replace: true },
    )
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'complete' | 'archive' | 'unarchive'
  const [pending, setPending] = useState(false)
  const isAdmin = me.role === ROLES.ADMIN

  const { data: project, loading, error, refetch } = useApi(() => projectsApi.get(id), [id])
  const { data: managersData } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER }) : Promise.resolve(null)), [isAdmin])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

  const canManage = Boolean(project) && (isAdmin || project.manager.id === me.id)
  const writable = canManage && project && !project.archived
  const canComplete = writable && project.status === 'active' && project.milestoneCounts.open === 0
  const released = project?.myMembership && !project.myMembership.isActive

  const ACTIONS = {
    complete: {
      title: 'Mark project complete?',
      message: 'All milestones are complete. Members will be released and become available for other projects. This cannot be undone.',
      run: () => projectsApi.complete(id),
      done: 'Project marked complete',
    },
    archive: {
      title: 'Archive project?',
      message: 'The project becomes read-only and hidden from everyone except admins. Members are released and become available.',
      run: () => projectsApi.archive(id),
      done: 'Project archived',
    },
    unarchive: {
      title: 'Unarchive project?',
      message: 'The project becomes visible again. If it is still active, its former members are re-added — unless they have since joined another project.',
      run: () => projectsApi.unarchive(id),
      done: 'Project restored',
    },
  }

  async function runConfirm() {
    const action = ACTIONS[confirm]
    setPending(true)
    try {
      await action.run()
      notify(action.done)
      setConfirm(null)
      refetch()
    } catch (err) {
      const names = err.details?.members?.map((m) => `${m.userId} (now on ${m.projectName})`).join(', ')
      setConfirm(null)
      notify(names ? `${err.message}: ${names}` : err.message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {error?.status === 403 ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/projects')}>
              All projects
            </Button>
          }
        >
          {me.role === ROLES.MANAGER ? "You don't manage this project, so it is not shown to you." : 'You are not on this project, so it is not shown to you.'}
        </Alert>
      ) : (
        <ErrorAlert error={error} onRetry={refetch} />
      )}
      {loading && !project && <Skeleton variant="rounded" height={240} />}
      {project && (
        <>
          <PageHeader
            back={{ label: 'All projects', to: '/projects' }}
            title={project.name}
            subtitle={`${formatDate(project.startDate)} to ${formatDate(project.endDate)}, managed by ${fullName(project.manager)}`}
            actions={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip status={project.status} archived={project.archived} size="medium" />
                <DueTag dueDate={project.endDate} isOpen={project.status === 'active' && !project.archived} soonDays={null} overdueLabel="Past end date" overdueTone="warning" size="medium" />
                {writable && (
                  <Button variant="outlined" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                )}
                {writable && project.status === 'active' && (
                  <Button variant="outlined" color="success" disabled={!canComplete} onClick={() => setConfirm('complete')}>
                    Mark complete
                  </Button>
                )}
                {isAdmin && !project.archived && (
                  <Button variant="outlined" color="warning" onClick={() => setConfirm('archive')}>
                    Archive
                  </Button>
                )}
                {isAdmin && project.archived && (
                  <Button variant="contained" onClick={() => setConfirm('unarchive')}>
                    Unarchive
                  </Button>
                )}
              </Stack>
            }
          />
          {project.archived && <Alert severity="warning" sx={{ mb: 2 }}>This project is archived and read-only. Only admins can see it.</Alert>}
          {released && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You were released from this project on {formatDate(project.myMembership.releasedAt)}. You can still view it.
            </Alert>
          )}
          {writable && project.status === 'active' && project.milestoneCounts.open > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {project.milestoneCounts.open} open milestone{project.milestoneCounts.open === 1 ? '' : 's'} must be completed before the project can be marked complete.
            </Alert>
          )}
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 3 }}>
            <Tab label="Overview" value="overview" />
            <Tab label={`Members (${project.memberCount})`} value="members" />
            <Tab label={`Milestones (${project.milestoneCounts.open + project.milestoneCounts.complete})`} value="milestones" />
            <Tab label="Time" value="time" />
          </Tabs>
          <Box role="tabpanel">
            {tab === 'overview' && <OverviewTab project={project} />}
            {tab === 'members' && <MembersTab project={project} canManage={canManage} onChanged={refetch} notify={notify} />}
            {tab === 'milestones' && <MilestonesTab project={project} canManage={canManage} onChanged={refetch} notify={notify} />}
            {tab === 'time' && <TimeTab project={project} canManage={canManage} onChanged={refetch} notify={notify} />}
          </Box>
          {writable && (
            <ProjectEditDialog
              key={project.id + String(editOpen)}
              open={editOpen}
              project={project}
              isAdmin={isAdmin}
              managers={managers}
              onClose={() => setEditOpen(false)}
              onSaved={() => {
                setEditOpen(false)
                notify('Project updated')
                refetch()
              }}
            />
          )}
          <ConfirmDialog
            open={Boolean(confirm)}
            title={confirm ? ACTIONS[confirm].title : ''}
            message={confirm ? ACTIONS[confirm].message : ''}
            confirmLabel={confirm === 'archive' ? 'Archive' : confirm === 'unarchive' ? 'Unarchive' : 'Mark complete'}
            confirmColor={confirm === 'archive' ? 'warning' : 'primary'}
            pending={pending}
            onConfirm={runConfirm}
            onClose={() => setConfirm(null)}
          />
        </>
      )}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
