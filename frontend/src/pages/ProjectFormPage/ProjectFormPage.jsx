import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProjectFields from '../../components/ProjectFields/ProjectFields.jsx'
import { validateProject } from '../../utils/projectForm.js'
import useApi from '../../hooks/useApi.js'
import useFormState from '../../hooks/useFormState.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { ROLES } from '../../utils/roles.js'

const INITIAL = { name: '', description: '', budget: '', startDate: '', endDate: '', managerId: '' }

/** Admin creates a project (ui-flow.md F3). */
export default function ProjectFormPage() {
  const navigate = useNavigate()
  const { values, errors, setField, setErrors, applyServerError } = useFormState(INITIAL)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)
  const { data: managersData } = useApi(() => usersApi.list({ role: ROLES.MANAGER }), [])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

  async function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validateProject(values, { requireManager: true })
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      const project = await projectsApi.create({
        name: values.name.trim(),
        description: values.description.trim(),
        budget: Number(values.budget),
        startDate: values.startDate,
        endDate: values.endDate,
        managerId: values.managerId,
      })
      navigate(`/projects/${project.id}`, { replace: true })
    } catch (err) {
      setFormError(applyServerError(err))
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader title="New project" subtitle="The manager you choose will staff it and set its milestones." />
      <Paper component="form" onSubmit={handleSubmit} noValidate sx={{ p: 3, maxWidth: 720 }}>
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <ProjectFields values={values} errors={errors} setField={setField} pending={pending} managers={managers} showManager />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => navigate('/projects')} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </>
  )
}
