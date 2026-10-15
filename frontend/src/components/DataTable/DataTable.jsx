import PropTypes from 'prop-types'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { PAGE_SIZE_OPTIONS } from './paging.js'

const SKELETON_ROWS = 4

/**
 * Presentational table: column config + rows (small density by default, D24). Shows skeletons while loading and an
 * empty-state message when there are no rows. Never fetches. With `pagination` it adds the
 * "1–10 of 112" footer once the list is longer than a page; the page itself is the parent's state (usually the URL),
 * the table only reports clicks.
 */
export default function DataTable({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyMessage = 'Nothing to show yet.',
  onRowClick,
  size = 'small',
  pagination,
}) {
  // the footer exists only when there is something to page to (or back from); a list that fits is just a list
  const showFooter = pagination && !loading && (pagination.total > pagination.pageSize || pagination.page > 0)
  return (
    <TableContainer component={Paper}>
      <Table size={size} sx={{ minWidth: columns.length > 3 ? 640 : 0 }}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.numeric ? 'right' : col.align} sx={{ width: col.width }}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading &&
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 7 }}>
                <Typography variant="body2" color="text.secondary">
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.numeric ? 'right' : col.align}
                    sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: col.nowrap || col.numeric ? 'nowrap' : undefined, color: col.muted ? 'text.secondary' : undefined }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {showFooter && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={pagination.onPageSizeChange ? PAGE_SIZE_OPTIONS : []}
          onPageChange={(_e, page) => pagination.onPageChange(page)}
          onRowsPerPageChange={pagination.onPageSizeChange ? (e) => pagination.onPageSizeChange(Number(e.target.value)) : undefined}
          labelRowsPerPage="Per page"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      )}
    </TableContainer>
  )
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      render: PropTypes.func,
      align: PropTypes.oneOf(['left', 'right', 'center']),
      width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      nowrap: PropTypes.bool,
      numeric: PropTypes.bool, // right-aligned, tabular, never wraps
      muted: PropTypes.bool, // secondary text colour for supporting columns
    }),
  ).isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  getRowKey: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.node,
  onRowClick: PropTypes.func,
  size: PropTypes.oneOf(['small', 'medium']),
  pagination: PropTypes.shape({
    page: PropTypes.number.isRequired, // 0-based
    pageSize: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    onPageSizeChange: PropTypes.func,
  }),
}
