import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionIconButton from './ActionIconButton.jsx'

describe('ActionIconButton', () => {
  it('has an accessible name, shows a tooltip and does not bubble its click to the row', async () => {
    const onClick = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow} role="row">
        <ActionIconButton label="Release member" aria-label="Release Daniel Kim" danger onClick={onClick}>
          <span>x</span>
        </ActionIconButton>
      </div>,
    )
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Release Daniel Kim' })
    await user.hover(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Release member')
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })
})
