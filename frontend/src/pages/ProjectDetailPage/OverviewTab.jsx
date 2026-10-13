import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

function Field({ label, value }) {
  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value ?? '—'}</Typography>
    </Box>
  )
}
Field.propTypes = { label: PropTypes.node.isRequired, value: PropTypes.node }

/** The three pillars for one project: time (hours), cost (budget, if allowed), resources (team). */
export default function OverviewTab({ project }) {
  const hasCosts = project.budget !== undefined
  const overBudget = hasCosts && Number(project.budgetRemaining) < 0
  return (
    <Stack spacing={3}>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
        <StatCard label="Capacity" value={formatHours(project.capacityHours)} hint={`${project.memberCount} member${project.memberCount === 1 ? '' : 's'} × working days × 8 h`} />
        <StatCard label="Hours assigned" value={formatHours(project.hoursAssigned)} hint="Sum of allocations" />
        <StatCard label="Hours completed" value={formatHours(project.hoursCompleted)} hint="Sum of logged time" />
        {hasCosts && <StatCard label="Budget" value={formatMoney(project.budget)} />}
        {hasCosts && <StatCard label="Cost consumed" value={formatMoney(project.costConsumed)} hint="Logged hours × hourly cost" />}
        {hasCosts && (
          <StatCard label="Budget remaining" value={formatMoney(project.budgetRemaining)} color={overBudget ? 'error.main' : 'success.main'} />
        )}
      </Stack>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Progress
        </Typography>
        <ProgressBar
          value={project.hoursCompleted}
          max={project.capacityHours}
          caption={`${formatHours(project.hoursCompleted)} completed of ${formatHours(project.capacityHours)} capacity`}
        />
        <Box sx={{ mt: 2 }}>
          <ProgressBar
            value={project.hoursAssigned}
            max={project.capacityHours}
            caption={`${formatHours(project.hoursAssigned)} assigned of ${formatHours(project.capacityHours)} capacity`}
          />
        </Box>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: 'wrap', mb: project.description ? 2 : 0 }}>
          <Field label="Manager" value={fullName(project.manager)} />
          <Field label="Start" value={formatDate(project.startDate)} />
          <Field label="End" value={formatDate(project.endDate)} />
          <Field label="Milestones" value={`${project.milestoneCounts.complete} complete · ${project.milestoneCounts.open} open`} />
          <Field label="Project ID" value={project.id} />
        </Stack>
        {project.description && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{project.description}</Typography>}
      </Paper>
    </Stack>
  )
}

OverviewTab.propTypes = {
  project: PropTypes.object.isRequired,
}
