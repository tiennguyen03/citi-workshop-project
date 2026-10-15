import { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import ActionIconButton from '../../components/ActionIconButton/ActionIconButton.jsx'
import DataTable from '../../components/DataTable/DataTable.jsx'
import SummaryRow from '../../components/SummaryRow/SummaryRow.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import * as usersApi from '../../services/users.js'

const TEMPLATE = [
  'username,firstName,lastName,email,jobTitle,salary,role,manager,password',
  'sam.ortiz,Sam,Ortiz,sam.ortiz@example.com,Delivery Manager,118000,manager,,Welcome2026!',
  'nina.cole,Nina,Cole,nina.cole@example.com,Analyst,72000,employee,sam.ortiz,',
].join('\n')

const COLUMNS = [
  { key: 'line', label: 'Line', numeric: true, width: 64 },
  { key: 'username', label: 'Username', nowrap: true, render: (r) => r.username ?? '—' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (r.status === 'ok' ? <Tag label="Ready" tone="success" variant="quiet" /> : <Tag label="Error" tone="error" />),
  },
  {
    key: 'errors',
    label: 'Problems',
    render: (r) =>
      r.errors.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {r.errors.map((e) => (
            <Typography key={e} component="li" variant="caption" color="error.main">
              {e}
            </Typography>
          ))}
        </Box>
      ),
  },
]

function PasswordCell({ password }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
    } catch {
      /* the text is visible; the admin can select it */
    }
  }
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography component="code" variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {password}
      </Typography>
      <ActionIconButton label="Copy password" onClick={copy}>
        <ContentCopyOutlinedIcon fontSize="small" />
      </ActionIconButton>
    </Stack>
  )
}
PasswordCell.propTypes = { password: PropTypes.string.isRequired }

const RESULT_COLUMNS = [
  { key: 'username', label: 'Username', nowrap: true },
  { key: 'generatedPassword', label: 'Temporary password', render: (r) => <PasswordCell password={r.generatedPassword} /> },
]

/**
 * Admin "Import CSV" (D26): choose or paste a file → preview every row with its problems → import all or nothing.
 * Generated passwords are shown once, here, with a copy button; they are never shown again.
 */
export default function UserImportDialog({ open, onClose, onImported }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [report, setReport] = useState(null)
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const reset = () => {
    setCsv('')
    setFileName('')
    setReport(null)
    setResult(null)
    setError(null)
  }
  const close = () => {
    if (pending) return
    reset()
    onClose()
  }

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCsv(String(reader.result ?? ''))
      setFileName(file.name)
      setReport(null)
      setError(null)
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'users-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function preview() {
    setPending(true)
    setError(null)
    try {
      setReport(await usersApi.importCsv(csv, { dryRun: true }))
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  async function commit() {
    setPending(true)
    setError(null)
    try {
      const done = await usersApi.importCsv(csv)
      setResult(done)
      onImported(done.summary.created)
    } catch (err) {
      // a row that became invalid between preview and import (someone took the username): show the fresh report
      if (err.details?.rows) setReport({ rows: err.details.rows, summary: err.details.summary })
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  const summary = report?.summary
  const canImport = Boolean(summary) && summary.invalid === 0 && summary.valid > 0
  const generated = result?.rows.filter((r) => r.generatedPassword) ?? []

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" aria-labelledby="import-dialog-title">
      <DialogTitle id="import-dialog-title">{result ? `Imported ${result.summary.created} user${result.summary.created === 1 ? '' : 's'}` : 'Import users from CSV'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {result ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {generated.length === 0
                  ? 'Everyone was created with the password from the file.'
                  : `${generated.length} ${generated.length === 1 ? 'person has' : 'people have'} a generated temporary password. Copy them now; they are not shown again.`}
              </Typography>
              {generated.length > 0 && <DataTable columns={RESULT_COLUMNS} rows={generated} getRowKey={(r) => r.username} />}
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                One person per line with a header row: username, firstName, lastName, email, jobTitle, salary, role, manager, password.
                The manager column takes the manager&apos;s username; a manager earlier in the same file counts. Leave the
                password blank to have one generated.{' '}
                <Link component="button" type="button" onClick={downloadTemplate} underline="hover">
                  Download the template
                </Link>
              </Typography>
              <Stack direction="row" useFlexGap spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-file" onChange={(e) => readFile(e.target.files?.[0])} />
                <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => fileRef.current?.click()} disabled={pending}>
                  Choose file
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {fileName || 'No file chosen; you can also paste the text below.'}
                </Typography>
              </Stack>
              <TextField
                label="CSV text"
                multiline
                minRows={4}
                maxRows={10}
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value)
                  setReport(null)
                }}
                disabled={pending}
                slotProps={{ htmlInput: { style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } } }}
              />
              {report && (
                <>
                  <SummaryRow
                    variant="tally"
                    aria-label="Import preview"
                    items={[
                      { key: 'ready', value: summary.valid, label: 'Ready', tone: 'success' },
                      ...(summary.invalid > 0 ? [{ key: 'fix', value: summary.invalid, label: 'Need fixing', tone: 'error' }] : []),
                    ]}
                  />
                  <DataTable columns={COLUMNS} rows={report.rows} getRowKey={(r) => r.line} />
                  {summary.invalid > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Fix the rows above in your file (or in the text) and preview again. Nothing is imported until every row is ready.
                    </Typography>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant={canImport ? 'outlined' : 'contained'} onClick={preview} disabled={pending || !csv.trim()}>
              {pending && !canImport ? 'Checking…' : 'Preview'}
            </Button>
            <Button variant="contained" onClick={commit} disabled={pending || !canImport}>
              {pending && canImport ? 'Importing…' : `Import${summary ? ` ${summary.valid}` : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

UserImportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func.isRequired,
}
