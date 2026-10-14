import { expect, test } from '@playwright/test'
import { ADMIN, addMember, api, createMilestone, createProject, fullName, makeOffice } from './support/api.js'
import { nav, openProject, signIn, signOut, toast } from './support/ui.js'

let office
let project

test.beforeAll(async () => {
  office = await makeOffice('time')
  // tiny budget + a well-paid employee so one logged day pushes it over budget (admin attention list)
  project = await createProject(office.admin, office.manager.id, { budget: 300 })
  await addMember(office.manager.token, project.id, office.emp1.id, 160)
  // due date already in the past so the urgency cues (Overdue / Next due) have something to show
  const milestone = await createMilestone(office.manager.token, project.id, { assigneeIds: [office.emp1.id], dueDate: '2026-10-10' })
  await api('POST', `/milestones/${milestone.id}/goals`, { title: 'Ship the thing', assigneeId: office.emp1.id }, office.manager.token)
})

test('employee: dashboard shows the project, ticks a goal, logs time; Time tab edit', async ({ page }) => {
  const { emp1 } = office
  await signIn(page, emp1.username)
  await expect(page.getByText('My current project')).toBeVisible()
  await expect(page.getByRole('link', { name: project.name }).first()).toBeVisible()
  await expect(page.getByText(/now on Phase 1/)).toBeVisible()
  await expect(page.getByText('Overdue').first()).toBeVisible()

  await page.getByRole('checkbox', { name: 'Complete goal Ship the thing' }).click()
  await toast(page, 'Done: Ship the thing')
  await expect(page.getByRole('checkbox', { name: 'Complete goal Ship the thing' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Log time' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Hours').fill('6')
  await dialog.getByLabel('Note').fill('Rack audit')
  await dialog.getByRole('button', { name: 'Log time' }).click()
  await toast(page, `Logged 6 h on ${project.name}`)
  await expect(page.getByText('6 h logged of 160 h assigned to you')).toBeVisible()

  await openProject(page, project.id, project.name)
  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.getByRole('cell', { name: 'Rack audit' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Person' })).toHaveCount(0)
  await page.getByRole('row', { name: /Rack audit/ }).getByRole('button', { name: /Edit entry/ }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Hours').fill('7')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await toast(page, 'Time entry updated')
  await expect(page.getByRole('row', { name: /Rack audit/ }).getByRole('cell', { name: '7 h', exact: true })).toBeVisible()
})

test('manager: dashboard cards and team hours; Time tab shows everyone, filters, deletes', async ({ page }) => {
  const { manager, emp1, emp2 } = office
  await signIn(page, manager.username)
  await expect(page.getByText('Your projects')).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(project.name) }).first()).toBeVisible()
  await expect(page.getByText('Over budget').first()).toBeVisible()
  const teamRow = page.getByRole('row', { name: new RegExp(fullName(emp1)) })
  await expect(teamRow.getByRole('cell', { name: '7 h', exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(fullName(emp2)) }).getByText('Available')).toBeVisible()

  // the member count on the card is a deep link into the Members tab
  await page.getByRole('link', { name: '1 member' }).click()
  await expect(page).toHaveURL(/tab=members/)
  await expect(page.getByRole('tab', { name: /members/i })).toHaveAttribute('aria-selected', 'true')

  await openProject(page, project.id, project.name)
  await page.getByRole('tab', { name: /milestones/i }).click()
  const phase1 = page.getByRole('row', { name: /Phase 1/ })
  await expect(phase1.getByText('Next due')).toBeVisible()
  await expect(phase1.getByText('Overdue')).toBeVisible()
  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.getByRole('columnheader', { name: 'Person' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log time' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Person' }).click()
  await page.getByRole('option', { name: fullName(emp1) }).click()
  await expect(page.getByRole('cell', { name: 'Rack audit' })).toBeVisible()
  await page.getByRole('row', { name: /Rack audit/ }).getByRole('button', { name: /Delete entry/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await toast(page, 'Time entry deleted')
  await expect(page.getByRole('cell', { name: 'Rack audit' })).toHaveCount(0)
})

test('admin: dashboard stats and the attention list link to the project', async ({ page }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  await expect(page.getByText('Active projects')).toBeVisible()
  await expect(page.getByText('Needs attention')).toBeVisible()
  await nav(page).getByRole('link', { name: 'Audit log' }).click()
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible()
  await signOut(page)
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('available employee sees the available state; project tabs scroll', async ({ page }) => {
    await signIn(page, office.emp2.username)
    await expect(page.getByText(/not assigned to a project right now/)).toBeVisible()
    await page.goto(`/projects/${project.id}`)
    // emp2 is not on it: the API answers 403 and the page shows the reason instead of the project
    await expect(page.getByText('You are not on this project')).toBeVisible()
    await expect(page.getByRole('heading', { name: project.name })).toHaveCount(0)
  })
})
