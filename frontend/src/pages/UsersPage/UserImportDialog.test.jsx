import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as usersApi from '../../services/users.js'
import UserImportDialog from './UserImportDialog.jsx'

vi.mock('../../services/users.js')

const CSV = 'username,firstName,lastName,email,jobTitle,salary,role,manager,password\nnina.cole,Nina,Cole,nina@x.com,Analyst,72000,employee,sam.ortiz,'
const ROW_OK = { line: 2, username: 'nina.cole', status: 'ok', errors: [] }
const ROW_BAD = { line: 3, username: 'dup', status: 'error', errors: ['username: already taken'] }

describe('UserImportDialog', () => {
  beforeEach(() => vi.resetAllMocks())

  it('previews the file, blocks import while a row has an error, then imports and shows generated passwords once', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()
    usersApi.importCsv.mockResolvedValueOnce({ rows: [ROW_OK, ROW_BAD], summary: { total: 2, valid: 1, invalid: 1, created: 0 } })
    render(<UserImportDialog open onClose={vi.fn()} onImported={onImported} />)

    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    await user.type(screen.getByLabelText('CSV text'), CSV)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByText('username: already taken')).toBeInTheDocument()
    expect(usersApi.importCsv).toHaveBeenLastCalledWith(expect.any(String), { dryRun: true })
    expect(screen.getByLabelText('Import preview')).toHaveTextContent(/Ready\s*1\s*Need fixing\s*1/)
    expect(screen.getByRole('button', { name: 'Import 1' })).toBeDisabled()

    // the admin fixes the file and previews again: all ready, import enabled
    usersApi.importCsv.mockResolvedValueOnce({ rows: [ROW_OK], summary: { total: 1, valid: 1, invalid: 0, created: 0 } })
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import 1' })).toBeEnabled())

    usersApi.importCsv.mockResolvedValueOnce({ rows: [{ ...ROW_OK, id: 'ABC123', generatedPassword: 'tmp-Secret9' }], summary: { total: 1, valid: 1, invalid: 0, created: 1 } })
    await user.click(screen.getByRole('button', { name: 'Import 1' }))
    expect(await screen.findByText('Imported 1 user')).toBeInTheDocument()
    expect(usersApi.importCsv).toHaveBeenLastCalledWith(expect.any(String))
    expect(screen.getByText('tmp-Secret9')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy password' })).toBeInTheDocument()
    expect(onImported).toHaveBeenCalledWith(1)
  })

  it('shows a whole-file problem from the API as an alert', async () => {
    const user = userEvent.setup()
    usersApi.importCsv.mockRejectedValueOnce(new Error('Missing columns: email, role'))
    render(<UserImportDialog open onClose={vi.fn()} onImported={vi.fn()} />)
    await user.type(screen.getByLabelText('CSV text'), 'username,firstName\na,b')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Missing columns: email, role')
  })
})
