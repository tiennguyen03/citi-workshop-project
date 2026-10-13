import { useState } from 'react'
import PropTypes from 'prop-types'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import ProjectFields from '../../components/ProjectFields/ProjectFields.jsx'
import { validateProject } from '../../utils/projectForm.js'
import useFormState from '../../hooks/useFormState.js'
import * as projectsApi from '../../services/projects.js'

function toValues(project) {
  return {
    name: project.name,
    description: project.description ?? '',
    budget: project.budget ?? '',
    startDate: String(project.startDate).slice(0, 10),
    endDate: String(project.endDate).slice(0, 10),
    managerId: project.manager.id,
  }
}

/** Edit project info/budget/dates (manager, admin) and manager (admin only). */
export default function ProjectEditDialog({ open, project, isAdmin, managers, onClose, onSaved }) {
  const { values, errors, setField, setErrors, reset, applyServerError } = useFormState(toValues(project))
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)

  function close() {
    reset(toValues(project))
    setFormError(null)
    onClose()
  }

  async function submit() {
    const clientErrors = validateProject(values, { requireManager: isAdmin })
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
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
    setPending(true)
    setFormError(null)
    try {
      const updated = await projectsApi.update(project.id, changes)
      onSaved(updated)
    } catch (err) {
      setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog open={open} title="Edit project" onClose={close} onSubmit={submit} pending={pending} error={formError}>
      <ProjectFields values={values} errors={errors} setField={setField} pending={pending} managers={managers} showManager={isAdmin} />
    </FormDialog>
  )
}

ProjectEditDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  managers: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
}
