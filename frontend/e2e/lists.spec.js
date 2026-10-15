import { expect, test } from '@playwright/test'
import { ADMIN, createUser, fullName, makeOffice, token, unique } from './support/api.js'
import { signIn } from './support/ui.js'

test('the users list pages on the server and searches across pages', async ({ page }) => {
  const office = await makeOffice('lists')
  const admin = await token(ADMIN.username, ADMIN.password)
  const run = unique('run') // each run gets its own surname, so reruns without reseeding stay unambiguous
  const extra = []
  for (let i = 0; i < 26; i += 1) {
    extra.push(await createUser(admin, { role: 'employee', managerId: office.manager.id, firstName: 'Page', lastName: `${run}-${i}`, jobTitle: 'Analyst' }))
  }
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto('/users')
  await expect(page.getByText(/^1–10 of \d+$/)).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(11) // header + 10
  await page.getByRole('button', { name: /next page/i }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText(/^11–\d+ of \d+$/)).toBeVisible()
  // searching resets to the first page and narrows across the whole list, not just the visible page
  await page.getByRole('searchbox', { name: 'Search' }).fill(fullName(extra[25]))
  await expect(page).toHaveURL(/q=/)
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByRole('row', { name: new RegExp(fullName(extra[25])) })).toBeVisible()
  await expect(page.getByText('1 person matches')).toBeVisible()
})
