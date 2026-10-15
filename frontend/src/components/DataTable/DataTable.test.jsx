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

  it('hides the footer when everything fits on one page, and offers 10 / 25 / 50 when it does not', async () => {
    const onPageSizeChange = vi.fn()
    const { rerender } = render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} pagination={{ page: 0, pageSize: 10, total: 2, onPageChange: vi.fn(), onPageSizeChange }} />)
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument()
    rerender(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} pagination={{ page: 0, pageSize: 10, total: 11, onPageChange: vi.fn(), onPageSizeChange }} />)
    expect(screen.getByText('1–10 of 11')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('combobox', { name: /per page/i }))
    await userEvent.setup().click(await screen.findByRole('option', { name: '25' }))
    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })

  it('shows no footer while loading or when the list is empty', () => {
    const { rerender } = render(<DataTable columns={COLUMNS} rows={[]} getRowKey={(r) => r.id} loading pagination={{ page: 0, pageSize: 25, total: 0, onPageChange: vi.fn() }} />)
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument()
    rerender(<DataTable columns={COLUMNS} rows={[]} getRowKey={(r) => r.id} pagination={{ page: 0, pageSize: 25, total: 0, onPageChange: vi.fn() }} />)
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument()
  })
})
