import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable from './DataTable.jsx'

const COLUMNS = [{ key: 'name', label: 'Name' }]
const ROWS = [{ id: '1', name: 'Ada' }, { id: '2', name: 'Grace' }]

describe('DataTable pagination', () => {
  it('shows the range and reports page clicks', async () => {
    const onPageChange = vi.fn()
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} pagination={{ page: 0, pageSize: 2, total: 5, onPageChange }} />)
    expect(screen.getByText('1–2 of 5')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /next page/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('stays quiet when everything fits on one page', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} pagination={{ page: 0, pageSize: 25, total: 2, onPageChange: vi.fn() }} />)
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument()
  })
})
