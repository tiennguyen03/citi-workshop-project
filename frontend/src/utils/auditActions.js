/** Plain-language names for the audit action codes the API records (core/audit.py ACTIONS). */
export const ACTION_LABELS = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Sign-in failed',
  'auth.password_change': 'Changed password',
  'user.create': 'Created a user',
  'user.update': 'Updated a user',
  'user.import': 'Imported users',
  'project.create': 'Created a project',
  'project.update': 'Updated a project',
  'project.complete': 'Completed a project',
  'project.archive': 'Archived a project',
  'project.unarchive': 'Restored a project',
  'project.member_add': 'Added a member',
  'project.member_update': 'Changed assigned hours',
  'project.member_remove': 'Released a member',
  'milestone.create': 'Created a milestone',
  'milestone.update': 'Updated a milestone',
  'milestone.complete': 'Completed a milestone',
  'milestone.reopen': 'Reopened a milestone',
  'goal.create': 'Added a goal',
  'goal.update': 'Updated a goal',
  'goal.delete': 'Deleted a goal',
  'time_entry.create': 'Logged time',
  'time_entry.update': 'Edited a time entry',
  'time_entry.delete': 'Deleted a time entry',
}

/** The label for a code, or the code itself for anything the UI does not know yet. */
export const actionLabel = (code) => ACTION_LABELS[code] ?? code
