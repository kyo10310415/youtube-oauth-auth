import { writeFile } from 'node:fs/promises'

// The code is a credential: write it to a new private file, never stdout/logs.
const [studentId, destination] = process.argv.slice(2)
if (!studentId || !destination || !process.env.YOUTUBE_INVITE_ADMIN_TOKEN) {
  console.error('Usage: node scripts/create-invitation.js <student-id> <new-private-file>')
  process.exit(1)
}
try {
  const origin = new URL(process.env.YOUTUBE_OAUTH_ORIGIN || 'https://youtube-oauth-auth.onrender.com')
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Invalid origin')
  const response = await fetch(new URL('/admin/invitations', origin), { method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YOUTUBE_INVITE_ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }), redirect: 'error' })
  if (!response.ok) throw new Error('Invitation creation failed')
  const data = await response.json()
  if (!/^[a-f0-9]{64}$/.test(data.invitation || '')) throw new Error('Invalid response')
  await writeFile(destination, data.invitation + '\n', { flag: 'wx', mode: 0o600 })
  console.log('Invitation saved to the requested file. Distribute it privately and remove the file afterward.')
} catch {
  console.error('Could not save an invitation. Check configuration and choose a new private output file.')
  process.exitCode = 1
}
