import { expect, test } from '@playwright/test'
import { addMember, createMilestone, createProject, fullName, makeOffice, unique } from './support/api.js'
import { confirmDialog, openProject, signIn, signOut, toast } from './support/ui.js'

let office
let project

test.beforeAll(async () => {
  office = await makeOffice('ms')
  project = await createProject(office.admin, office.manager.id)
  await addMember(office.manager.token, project.id, office.emp1.id, 200)
  await addMember(office.manager.token, project.id, office.emp2.id, 200)
})

test('milestone life cycle: create with assignee, goals, employee ticks own, complete with warning, project unlocks', async ({ page }) => {
  const { manager, emp1, emp2 } = office
  await signIn(page, manager.username)
  await openProject(page, project.id, project.name)
  await page.getByRole('tab', { name: /milestones/i }).click()
  await expect(page.getByText('No milestones yet.')).toBeVisible()
  await expect(page.getByText(/Free for a new milestone/)).toContainText(fullName(emp1))

  await page.getByRole('button', { name: 'New milestone' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Name/).fill('Count the racks')
  await dialog.getByLabel('Due date').fill('2026-10-30')
  await dialog.getByRole('combobox', { name: 'Assignees' }).click()
  await page.getByRole('option', { name: new RegExp(fullName(emp1)) }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Create milestone' }).click()
  await toast(page, "Created milestone 'Count the racks'")
  await expect(page.getByText(/Free for a new milestone/)).not.toContainText(fullName(emp1))
  await page.getByRole('tab', { name: /members/i }).click()
  await expect(page.getByRole('row', { name: new RegExp(fullName(emp1)) }).getByRole('link', { name: 'Count the racks' })).toBeVisible()
  await page.getByRole('tab', { name: /milestones/i }).click()

  // busy member is greyed out when planning the next milestone
  await page.getByRole('button', { name: 'New milestone' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Assignees' }).click()
  await expect(page.getByRole('option', { name: new RegExp(fullName(emp1)) })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('option', { name: new RegExp(fullName(emp2)) })).not.toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('cell', { name: /Count the racks/ }).click()
  await expect(page.getByRole('heading', { name: 'Count the racks' })).toBeVisible()
  await page.getByLabel('New goal').fill('Record rack IDs')
  await page.getByRole('combobox', { name: 'Assignee' }).click()
  await page.getByRole('option', { name: fullName(emp1) }).click()
  await page.getByRole('button', { name: 'Add goal' }).click()
  await expect(page.getByText('Record rack IDs')).toBeVisible()
  await page.getByLabel('New goal').fill('Photograph cable trays')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await expect(page.getByText('0 / 2 done')).toBeVisible()
  const milestoneUrl = page.url()
  await signOut(page)

  await signIn(page, emp1.username)
  await page.goto(milestoneUrl)
  await expect(page.getByRole('heading', { name: 'Count the racks' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Complete goal Photograph cable trays' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Complete goal Record rack IDs' }).click()
  await expect(page.getByText('1 / 2 done')).toBeVisible()
  await signOut(page)

  await signIn(page, manager.username)
  await page.goto(milestoneUrl)
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByRole('dialog').getByText(/1 goal is still open/)).toBeVisible()
  await confirmDialog(page, 'Mark complete')
  await toast(page, 'Milestone completed')
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Photograph cable trays/ })).toBeDisabled()

  await openProject(page, project.id, project.name)
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeEnabled()
})

test('a milestone that waits on another cannot be completed first; the chain shows on the tab', async ({ page }) => {
  const { manager, admin } = office
  const chained = await createProject(admin, manager.id, { name: `E2E chain ${unique('dep')}` })
  const pack = await createMilestone(manager.token, chained.id, { name: 'Pack', dueDate: '2026-10-09' })
  const move = await createMilestone(manager.token, chained.id, { name: 'Move', startDate: '2026-10-12', dueDate: '2026-10-16', blockedById: pack.id })

  await signIn(page, manager.username)
  await openProject(page, chained.id, chained.name)
  await page.getByRole('tab', { name: /milestones/i }).click()
  await expect(page.getByText('Waits on Pack')).toBeVisible()

  await page.goto(`/milestones/${move.id}`)
  await expect(page.getByRole('heading', { name: 'Move' })).toBeVisible()
  await expect(page.getByText(/which is still open/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeDisabled()

  await page.goto(`/milestones/${pack.id}`)
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await confirmDialog(page, 'Mark complete')
  await toast(page, 'Milestone completed')

  await page.goto(`/milestones/${move.id}`)
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeEnabled()
  await openProject(page, chained.id, chained.name)
  await page.getByRole('tab', { name: /milestones/i }).click()
  await expect(page.getByText('After Pack')).toBeVisible()
})
