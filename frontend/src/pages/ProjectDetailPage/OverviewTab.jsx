import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import FieldList from '../../components/FieldList/FieldList.jsx'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

/** The three pillars for one project: time (hours), cost (budget, if allowed), resources (team). */
export default function OverviewTab({ project }) {
  const hasCosts = project.budget !== undefined
  const overBudget = hasCosts && Number(project.budgetRemaining) < 0
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <StatCard label="Capacity" value={formatHours(project.capacityHours)} hint={`${project.memberCount} member${project.memberCount === 1 ? '' : 's'} × working days × 8 h`} />
        <StatCard label="Hours assigned" value={formatHours(project.hoursAssigned)} hint="Sum of allocations" />
        <StatCard label="Hours completed" value={formatHours(project.hoursCompleted)} hint="Sum of logged time" />
        {hasCosts && <StatCard label="Budget" value={formatMoney(project.budget)} />}
        {hasCosts && <StatCard label="Cost consumed" value={formatMoney(project.costConsumed)} hint="Logged hours × hourly cost" />}
        {hasCosts && (
          <StatCard label="Budget remaining" value={formatMoney(project.budgetRemaining)} color={overBudget ? 'error.main' : 'success.main'} />
        )}
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
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
        <FieldList
          columns={5}
          items={[
            { label: 'Manager', value: fullName(project.manager) },
            { label: 'Start', value: formatDate(project.startDate) },
            { label: 'End', value: formatDate(project.endDate) },
            { label: 'Milestones', value: `${project.milestoneCounts.complete} complete, ${project.milestoneCounts.open} open` },
            { label: 'Project ID', value: project.id },
          ]}
        />
        {project.description && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 3 }}>
            {project.description}
          </Typography>
        )}
      </Paper>
    </Stack>
  )
}

OverviewTab.propTypes = {
  project: PropTypes.object.isRequired,
}
