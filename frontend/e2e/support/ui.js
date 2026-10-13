import { expect } from '@playwright/test'
import { PASSWORD } from './api.js'

/** Sidebar navigation. The dashboard's shortcut cards are links with the same names, so scope to the nav. */
export const nav = (page) => page.getByRole('navigation', { name: 'Main navigation' })

export async function signIn(page, username, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
}

export async function signOut(page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
}

export async function openProject(page, projectId, name) {
  await page.goto(`/projects/${projectId}`)
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

export async function confirmDialog(page, buttonName) {
  await page.getByRole('dialog').getByRole('button', { name: buttonName, exact: true }).click()
}

export const toast = (page, text) => expect(page.getByText(text)).toBeVisible()
