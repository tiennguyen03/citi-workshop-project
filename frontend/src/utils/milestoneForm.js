/** Client-side checks mirroring the API contract for milestone create/edit. Returns {field: message}. */
export function validateMilestone(values, project) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Required'
  if (!values.startDate) errors.startDate = 'Required'
  if (!values.dueDate) errors.dueDate = 'Required'
  const projectStart = String(project.startDate).slice(0, 10)
  const projectEnd = String(project.endDate).slice(0, 10)
  if (values.startDate && values.startDate < projectStart) errors.startDate = `On or after the project start (${projectStart})`
  if (values.dueDate && values.dueDate > projectEnd) errors.dueDate = `On or before the project end (${projectEnd})`
  if (values.startDate && values.dueDate && values.dueDate < values.startDate) {
    errors.dueDate = 'Must be on or after the start date'
  }
  return errors
}

/** Form values for the edit dialog from a Milestone. */
export function toMilestoneValues(milestone) {
  return {
    name: milestone.name,
    description: milestone.description ?? '',
    startDate: String(milestone.startDate).slice(0, 10),
    dueDate: String(milestone.dueDate).slice(0, 10),
    assigneeIds: milestone.assignees.map((a) => a.id),
  }
}

/** Which milestone fields changed, in API (camelCase) shape. */
export function milestoneChanges(original, values) {
  const changes = {}
  if (values.name.trim() !== original.name) changes.name = values.name.trim()
  if (values.description.trim() !== original.description) changes.description = values.description.trim()
  if (values.startDate !== original.startDate) changes.startDate = values.startDate
  if (values.dueDate !== original.dueDate) changes.dueDate = values.dueDate
  const same = values.assigneeIds.length === original.assigneeIds.length && values.assigneeIds.every((id) => original.assigneeIds.includes(id))
  if (!same) changes.assigneeIds = values.assigneeIds
  return changes
}

/** Turn a MILESTONE_CONFLICT error into a readable field message. */
export function conflictMessage(error, people) {
  const byId = new Map(people.map((p) => [p.id, p]))
  const parts = (error.details?.conflicts ?? []).map((c) => {
    const person = byId.get(c.userId)
    const name = person ? `${person.firstName} ${person.lastName}` : c.userId
    return `${name} is on '${c.milestoneName}'`
  })
  return parts.length ? `${parts.join('; ')}. Complete that milestone first.` : error.message
}
