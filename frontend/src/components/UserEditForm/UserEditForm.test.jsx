import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserEditForm from './UserEditForm.jsx'
import { changedFields } from '../../utils/userForm.js'

const USER = {
  id: 'EMP001',
  firstName: 'Eve',
  lastName: 'Employee',
  email: 'eve@x.com',
  jobTitle: 'Engineer',
  salary: 80000,
  role: 'employee',
  managerId: 'MGR001',
  isActive: true,
}
const MANAGERS = [
  { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' },
  { id: 'MGR002', firstName: 'Max', lastName: 'Boss' },
]

describe('UserEditForm', () => {
  it('shows only name and email for a non-admin and sends only changed fields', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue()
    render(<UserEditForm user={USER} canEditNameEmail onSave={onSave} />)

    expect(screen.queryByLabelText(/job title/i)).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: /save changes/i })
    expect(save).toBeDisabled()

    const first = screen.getByLabelText(/first name/i, { selector: 'input' })
    await user.clear(first)
    await user.type(first, 'Eva')
    expect(save).toBeEnabled()
    await user.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ firstName: 'Eva' }))
  })

  it('lets an admin change role, manager and active flag', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue()
    render(<UserEditForm user={USER} canEditNameEmail isAdmin managers={MANAGERS} onSave={onSave} />)

    await user.click(screen.getByRole('combobox', { name: /manager/i }))
    await user.click(await screen.findByRole('option', { name: 'Max Boss' }))
    await user.click(screen.getByLabelText(/can sign in/i))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ managerId: 'MGR002', isActive: false }))
  })

  it('maps a server field error onto the field', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('Email is already in use'), { status: 409, details: { field: 'email' } })
    render(<UserEditForm user={USER} canEditNameEmail onSave={vi.fn().mockRejectedValue(error)} />)
    const email = screen.getByLabelText(/email/i, { selector: 'input' })
    await user.clear(email)
    await user.type(email, 'taken@x.com')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Email is already in use')).toBeInTheDocument()
  })

  it('changedFields ignores untouched values and coerces salary', () => {
    const values = { ...USER, salary: '90000', managerId: 'MGR001' }
    expect(changedFields(USER, values, ['salary', 'managerId', 'firstName'])).toEqual({ salary: 90000 })
  })
})
