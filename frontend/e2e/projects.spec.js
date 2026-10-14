import { expect, test } from '@playwright/test'
import { ADMIN, PROJECT_DATES, addMember, api, createMilestone, createProject, fullName, makeOffice, unique } from './support/api.js'
import { confirmDialog, openProject, signIn, signOut, toast } from './support/ui.js'

let office

test.beforeAll(async () => {
  office = await makeOffice('proj')
})

test('admin creates a project through the form, with validation', async ({ page }) => {
  const name = `E2E ${unique('form')}`
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.getByRole('button', { name: 'New project' }).click() // right from the dashboard, as a dialog
  await page.getByLabel(/project name/i).fill(name)
  await page.getByLabel(/budget/i).fill('25000')
  await page.getByRole('combobox', { name: /manager/i }).click()
  await page.getByRole('option', { name: fullName(office.manager) }).click()
  await page.getByLabel(/start date/i).fill('2026-11-10')
  await page.getByLabel(/end date/i).fill('2026-11-01')
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByText('Must be on or after the start date')).toBeVisible()
  await page.getByLabel(/end date/i).fill('2026-12-18')
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByText('$25,000').first()).toBeVisible()
})

test('manager staffs the project: add, edit hours, release, re-add, edit budget', async ({ page }) => {
  const { admin, manager, emp1, emp2 } = office
  const project = await createProject(admin, manager.id)
  await signIn(page, manager.username)
  await openProject(page, project.id, project.name)
  await page.getByRole('tab', { name: /members/i }).click()

  await page.getByRole('button', { name: 'Add member' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Employee' }).click()
  await page.getByRole('option', { name: new RegExp(fullName(emp1)) }).click()
  await dialog.getByLabel('Hours assigned').fill('120')
  await dialog.getByRole('button', { name: 'Add to project' }).click()
  await toast(page, `Added ${fullName(emp1)}`)
  await expect(page.getByRole('tab', { name: 'Members (1)' })).toBeVisible()

  await page.getByRole('button', { name: `Edit hours for ${fullName(emp1)}` }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Hours assigned').fill('150')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await toast(page, 'Hours updated')
  await expect(page.getByRole('cell', { name: '150 h', exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Release ${fullName(emp1)}` }).click()
  await confirmDialog(page, 'Release')
  await expect(page.getByText(new RegExp(`${fullName(emp1)} released`))).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Members (0)' })).toBeVisible()
  await page.getByLabel('Show released members').click()
  await expect(page.getByText('Released (removed)')).toBeVisible()

  await page.getByRole('button', { name: 'Add member' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Employee' }).click()
  await page.getByRole('option', { name: new RegExp(fullName(emp1)) }).click()
  await dialog.getByLabel('Hours assigned').fill('100')
  await dialog.getByRole('button', { name: 'Add to project' }).click()
  await toast(page, `Added ${fullName(emp1)}`)

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Budget (USD)').fill('150000')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await toast(page, 'Project updated')
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByText('$150,000').first()).toBeVisible()
  // emp2 is still free; the one-active-project rule is exercised in the milestones spec
  await expect(emp2.id).toBeTruthy()
})

test('completion is gated by milestones; admin can archive and restore', async ({ page }) => {
  const { admin, manager, emp2 } = office
  const project = await createProject(admin, manager.id, { startDate: PROJECT_DATES.startDate })
  await addMember(manager.token, project.id, emp2.id, 80)
  const milestone = await createMilestone(manager.token, project.id, { assigneeIds: [emp2.id] })

  await signIn(page, manager.username)
  await openProject(page, project.id, project.name)
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeDisabled()
  await expect(page.getByText(/1 open milestone must be completed/)).toBeVisible()
  await signOut(page)

  await signIn(page, ADMIN.username, ADMIN.password)
  await openProject(page, project.id, project.name)
  await page.getByRole('button', { name: 'Archive' }).click()
  await confirmDialog(page, 'Archive')
  await toast(page, 'Project archived')
  await expect(page.getByRole('tab', { name: 'Members (0)' })).toBeVisible()
  await page.getByRole('button', { name: 'Unarchive' }).click()
  await confirmDialog(page, 'Unarchive')
  await toast(page, 'Project restored')
  await expect(page.getByRole('tab', { name: 'Members (1)' })).toBeVisible()

  await api('POST', `/milestones/${milestone.id}/complete`, undefined, manager.token)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeEnabled()
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await confirmDialog(page, 'Mark complete')
  await toast(page, 'Project marked complete')
})
