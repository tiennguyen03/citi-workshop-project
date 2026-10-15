import { expect, test } from '@playwright/test'
import { ADMIN, unique } from './support/api.js'
import { signIn } from './support/ui.js'

test('admin previews and imports a small team from CSV, including a manager created in the same file', async ({ page }) => {
  const run = unique('imp').replace(/[^a-z0-9]/g, '')
  const csv = [
    'username,firstName,lastName,email,jobTitle,salary,role,manager,password',
    `lena.marsh.${run},Lena,Marsh,lena.marsh.${run}@example.com,Delivery Manager,118000,manager,,Welcome2026!`,
    `omar.haddad.${run},Omar,Haddad,omar.haddad.${run}@example.com,Analyst,72000,employee,lena.marsh.${run},`,
    `admin,Dup,Licate,dup.${run}@example.com,Analyst,72000,employee,lena.marsh.${run},Welcome2026!`, // username taken
  ].join('\n')
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto('/users')
  await page.getByRole('button', { name: 'Import CSV' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('CSV text').fill(csv)
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(dialog.getByText('username: already taken')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Import 2' })).toBeDisabled()

  // drop the bad line, preview again, import
  await dialog.getByLabel('CSV text').fill(csv.split('\n').slice(0, 3).join('\n'))
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(dialog.getByRole('button', { name: 'Import 2' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Import 2' }).click()
  await expect(dialog.getByText('Imported 2 users')).toBeVisible()
  await expect(dialog.getByRole('cell', { name: `omar.haddad.${run}` })).toBeVisible() // the generated password row
  await dialog.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('searchbox', { name: 'Search' }).fill(`haddad.${run}`)
  await expect(page.getByText('1 person matches')).toBeVisible()
  const omar = page.getByRole('row', { name: new RegExp(`omar\\.haddad\\.${run}`) }) // the row carries the email, unique per run
  await expect(omar).toBeVisible()
  await expect(omar.getByText('Lena Marsh')).toBeVisible() // manager from the same file
})
