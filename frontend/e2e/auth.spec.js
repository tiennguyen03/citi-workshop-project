import { expect, test } from '@playwright/test'
import { ADMIN, PASSWORD, api, fullName, makeOffice } from './support/api.js'
import { nav, signIn, signOut, toast } from './support/ui.js'

let office

test.beforeAll(async () => {
  office = await makeOffice('auth')
})

test('wrong password shows the reason and keeps the form usable', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill(office.emp1.username)
  await page.getByLabel('Password').fill('not-it')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid username or password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})

test('admin deactivates a user, who is locked out until reactivated; the audit log records it', async ({ page }) => {
  const { emp2 } = office
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto(`/users/${emp2.id}`)
  await expect(page.getByRole('heading', { name: fullName(emp2) })).toBeVisible()
  const active = page.locator('form input[type="checkbox"]').first()
  await active.click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await toast(page, 'Changes saved')
  await signOut(page)

  await page.goto('/login')
  await page.getByLabel('Username').fill(emp2.username)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/deactivated/i)).toBeVisible()

  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto(`/users/${emp2.id}`)
  await expect(page.getByRole('heading', { name: fullName(emp2) })).toBeVisible()
  await page.locator('form input[type="checkbox"]').first().click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await toast(page, 'Changes saved')

  await nav(page).getByRole('link', { name: 'Audit log' }).click()
  await page.getByRole('combobox', { name: 'Action' }).click()
  await page.getByRole('option', { name: /user\.update/ }).click()
  const me = await api('GET', '/auth/me', undefined, office.admin) // the admin may have renamed themselves in the UI
  await page.getByRole('combobox', { name: 'Actor' }).click()
  await page.getByRole('option', { name: fullName(me) }).click()
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(/action=user\.update&actorId=/)
  await expect(page.getByText(new RegExp(`Updated user '${emp2.username}'`)).first()).toBeVisible()
  await expect(page.getByText('auth.login', { exact: true })).toHaveCount(0)

  // from a person's page, "View activity" lands on the log filtered to them; the history table shows their projects
  await page.goto(`/users/${emp2.id}`)
  await expect(page.getByText('Not on any project yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: fullName(office.manager) })).toBeVisible() // Reports to
  await page.getByRole('button', { name: 'View activity' }).click()
  await expect(page).toHaveURL(new RegExp(`actorId=${emp2.id}`))
  await expect(page.getByText(`User '${emp2.username}' logged in`).first()).toBeVisible()
})

test('an employee changes their own password; an admin can set a temporary one', async ({ page }) => {
  const { emp1 } = office
  await signIn(page, emp1.username)
  await nav(page).getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { name: 'Password' })).toBeVisible()
  await page.locator('input[name="currentPassword"]').fill('wrong-one')
  await page.locator('input[name="newPassword"]').fill('Avery-new-2026')
  await page.locator('input[name="confirmPassword"]').fill('Avery-new-2026')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Current password is incorrect')).toBeVisible()
  await page.locator('input[name="currentPassword"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Change password' }).click()
  await toast(page, 'Password changed')
  await signOut(page)

  await signIn(page, emp1.username, 'Avery-new-2026')
  await signOut(page)

  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto(`/users/${emp1.id}`)
  await page.getByRole('button', { name: 'Reset password' }).click()
  await page.getByRole('dialog').locator('input[type="text"]').first().fill('Temp-2026-x')
  await page.getByRole('dialog').getByRole('button', { name: 'Set password' }).click()
  await toast(page, `Temporary password set for ${fullName(emp1)}`)
  await signOut(page)
  await signIn(page, emp1.username, 'Temp-2026-x')
  // leave the account on the shared default again so other specs stay readable
  await api('POST', '/auth/change-password', { currentPassword: 'Temp-2026-x', newPassword: PASSWORD }, emp1.token)
})

test('an employee cannot open admin pages', async ({ page }) => {
  await signIn(page, office.emp1.username)
  await page.goto('/audit-log')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})
