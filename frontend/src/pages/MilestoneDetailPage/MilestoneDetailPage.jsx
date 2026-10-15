import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import FieldList from '../../components/FieldList/FieldList.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as milestonesApi from '../../services/milestones.js'
import * as projectsApi from '../../services/projects.js'
import { formatDate, formatDateTime } from '../../utils/format.js'
import { ROLES, fullName } from '../../utils/roles.js'
import MilestoneDialog from '../ProjectDetailPage/MilestoneDialog.jsx'
import GoalList from './GoalList.jsx'

/** One milestone: header, assignees, goal checklist, complete/reopen (ui-flow.md F5/F6). */
export default function MilestoneDetailPage() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const { notice, notify, clear } = useNotice()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'complete' | 'reopen'
  const [pending, setPending] = useState(false)

  const { data: milestone, loading, error, refetch } = useApi(() => milestonesApi.get(id), [id])
  const projectId = milestone?.projectId
  const { data: project, refetch: refetchProject } = useApi(
    () => (projectId ? projectsApi.get(projectId) : Promise.resolve(null)),
    [projectId],
  )

  const canManage = Boolean(project) && (me.role === ROLES.ADMIN || project.manager.id === me.id)
  const projectWritable = Boolean(project) && !project.archived && project.status === 'active'
  const isOpen = milestone?.status === 'open'
  const activeMember = project?.myMembership?.isActive === true
  const canEditGoals = canManage && projectWritable && isOpen
  const canTick = (goal) => projectWritable && isOpen && (canManage || (activeMember && goal.assignee?.id === me.id))

  const openGoals = milestone ? milestone.goalsTotal - milestone.goalsDone : 0
  const ACTIONS = {
    complete: {
      title: 'Mark milestone complete?',
      message:
        openGoals > 0
          ? `${openGoals} goal${openGoals === 1 ? ' is' : 's are'} still open. You can complete the milestone anyway; its assignees become free for the next one.`
          : 'Its assignees become free for the next milestone.',
      label: 'Mark complete',
      run: () => milestonesApi.complete(id),
      done: 'Milestone completed',
    },
    reopen: {
      title: 'Reopen milestone?',
      message: 'Goals become editable again. This fails if an assignee has since joined another open milestone.',
      label: 'Reopen',
      run: () => milestonesApi.reopen(id),
      done: 'Milestone reopened',
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
      refetchProject()
    } catch (err) {
      setConfirm(null)
      notify(err.message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <ErrorAlert error={error} onRetry={refetch} />
      {loading && !milestone && <Skeleton variant="rounded" height={240} />}
      {milestone && (
        <>
          <PageHeader
            back={{ label: project ? project.name : 'Project', to: `/projects/${milestone.projectId}` }}
            title={milestone.name}
            subtitle={`${formatDate(milestone.startDate)} to ${formatDate(milestone.dueDate)}. ${milestone.goalsDone} of ${milestone.goalsTotal} goals done.`}
            actions={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip status={milestone.status} size="medium" />
                <DueTag dueDate={milestone.dueDate} isOpen={isOpen && projectWritable} size="medium" />
                {canManage && projectWritable && isOpen && (
                  <Button variant="outlined" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                )}
                {canManage && projectWritable && isOpen && (
                  <Button variant="contained" onClick={() => setConfirm('complete')}>
                    Mark complete
                  </Button>
                )}
                {canManage && projectWritable && !isOpen && (
                  <Button variant="outlined" onClick={() => setConfirm('reopen')}>
                    Reopen
                  </Button>
                )}
              </Stack>
            }
          />
          {project && !projectWritable && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This project is {project.archived ? 'archived' : 'complete'}, so the milestone is read-only.
            </Alert>
          )}
          {!isOpen && projectWritable && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Completed on {formatDateTime(milestone.completedAt)}. Reopen it to change goals.
            </Alert>
          )}
          <Paper sx={{ p: 3, mb: 3 }}>
            <FieldList
              columns={3}
              items={[
                { label: 'Start', value: formatDate(milestone.startDate) },
                { label: 'Due', value: formatDate(milestone.dueDate) },
                { label: 'Completed', value: milestone.completedAt ? formatDate(milestone.completedAt) : '—' },
              ]}
            />
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
              Assignees
            </Typography>
            <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
              {milestone.assignees.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nobody assigned yet
                </Typography>
              )}
              {milestone.assignees.map((a) => (
                <Tag key={a.id} label={a.id === me.id ? `${fullName(a)} (you)` : fullName(a)} tone={a.id === me.id ? 'primary' : 'neutral'} variant="quiet" size="medium" />
              ))}
            </Stack>
            {project && !canManage && projectWritable && isOpen && !milestone.assignees.some((a) => a.id === me.id) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Only people assigned to this milestone can tick its goals.
              </Typography>
            )}
            {milestone.description && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 2.5 }}>
                {milestone.description}
              </Typography>
            )}
          </Paper>
          <GoalList milestone={milestone} canManage={canEditGoals} canTick={canTick} onChanged={refetch} notify={notify} />
          {project && canManage && projectWritable && (
            <MilestoneDialog
              key={`${milestone.id}-${String(editOpen)}`}
              open={editOpen}
              project={project}
              milestone={milestone}
              onClose={() => setEditOpen(false)}
              onSaved={() => {
                setEditOpen(false)
                notify('Milestone updated')
                refetch()
              }}
            />
          )}
          <ConfirmDialog
            open={Boolean(confirm)}
            title={confirm ? ACTIONS[confirm].title : ''}
            message={confirm ? ACTIONS[confirm].message : ''}
            confirmLabel={confirm ? ACTIONS[confirm].label : 'Confirm'}
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
