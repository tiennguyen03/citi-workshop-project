import { useState } from 'react'
import PropTypes from 'prop-types'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import ProjectFields from '../../components/ProjectFields/ProjectFields.jsx'
import { validateProject } from '../../utils/projectForm.js'
import useFormState from '../../hooks/useFormState.js'
import * as projectsApi from '../../services/projects.js'

const EMPTY = { name: '', description: '', budget: '', startDate: '', endDate: '', managerId: '' }

function toValues(project) {
  if (!project) return EMPTY
  return {
    name: project.name,
    description: project.description ?? '',
    budget: project.budget ?? '',
    startDate: String(project.startDate).slice(0, 10),
    endDate: String(project.endDate).slice(0, 10),
    managerId: project.manager.id,
  }
}

/**
 * Create a project (admin; `project` is null) or edit one (manager: info/budget/dates; admin also the manager).
 * One dialog for both so creating feels like every other "new …" action in the app (ui-flow.md F3).
 */
export default function ProjectDialog({ open, project = null, isAdmin, managers, onClose, onSaved }) {
  const { values, errors, setField, setErrors, reset, applyServerError } = useFormState(toValues(project))
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)
  const creating = project === null

  function close() {
    reset(toValues(project))
    setFormError(null)
    onClose()
  }

  async function submit() {
    const clientErrors = validateProject(values, { requireManager: creating || isAdmin })
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    let request
    if (creating) {
      request = () =>
        projectsApi.create({
          name: values.name.trim(),
          description: values.description.trim(),
          budget: Number(values.budget),
          startDate: values.startDate,
          endDate: values.endDate,
          managerId: values.managerId,
        })
    } else {
      const original = toValues(project)
      const changes = {}
      if (values.name.trim() !== original.name) changes.name = values.name.trim()
      if (values.description.trim() !== original.description) changes.description = values.description.trim()
      if (Number(values.budget) !== Number(original.budget)) changes.budget = Number(values.budget)
      if (values.startDate !== original.startDate) changes.startDate = values.startDate
      if (values.endDate !== original.endDate) changes.endDate = values.endDate
      if (isAdmin && values.managerId !== original.managerId) changes.managerId = values.managerId
      if (Object.keys(changes).length === 0) {
        close()
        return
      }
      request = () => projectsApi.update(project.id, changes)
    }
    setPending(true)
    setFormError(null)
    try {
      onSaved(await request())
    } catch (err) {
      setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog
      open={open}
      title={creating ? 'New project' : 'Edit project'}
      submitLabel={creating ? 'Create project' : 'Save'}
      onClose={close}
      onSubmit={submit}
      pending={pending}
      error={formError}
    >
      <ProjectFields values={values} errors={errors} setField={setField} pending={pending} managers={managers} showManager={creating || isAdmin} />
    </FormDialog>
  )
}

ProjectDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.object,
  isAdmin: PropTypes.bool.isRequired,
  managers: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
}
