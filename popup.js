/**
 * Jobster - popup.js (merged)
 * Handles: Login, Job Tracker (scrape + save), Gmail OAuth + Sync
 */

const API_BASE = 'http://localhost:8080/api/v1'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginView = document.getElementById('loginView')
const trackerView = document.getElementById('trackerView')
const gmailView = document.getElementById('gmailView')
const successView = document.getElementById('successView')
const tabBar = document.getElementById('tabBar')
const statusDot = document.getElementById('statusDot')
const loginToast = document.getElementById('loginToast')
const jobToast = document.getElementById('jobToast')
const scrapeBadge = document.getElementById('scrapeBadge')
const loggedInEmail = document.getElementById('loggedInEmail')
const successMsg = document.getElementById('successMsg')

// Gmail refs
const gmailConnectSection = document.getElementById('gmailConnectSection')
const gmailSyncSection = document.getElementById('gmailSyncSection')
const gmailUserCard = document.getElementById('gmailUserCard')
const gmailAvatarInitials = document.getElementById('gmailAvatarInitials')
const gmailUserName = document.getElementById('gmailUserName')
const gmailUserEmail = document.getElementById('gmailUserEmail')
const btnConnect = document.getElementById('btnConnect')
const btnSync = document.getElementById('btnSync')
const btnDisconnect = document.getElementById('btnDisconnect')
const syncLog = document.getElementById('syncLog')
const lastSyncText = document.getElementById('lastSyncText')
const syncSpinner = document.getElementById('syncSpinner')
const syncIcon = document.getElementById('syncIcon')

document
  .getElementById('tabTracker')
  .addEventListener('click', () => switchTab('tracker'))
document
  .getElementById('tabGmail')
  .addEventListener('click', () => switchTab('gmail'))

// ── Helpers ───────────────────────────────────────────────────────────────────
function showView(view) {
  ;[loginView, trackerView, gmailView, successView].forEach((v) =>
    v.classList.remove('active')
  )
  view.classList.add('active')
  tabBar.style.display =
    view === trackerView || view === gmailView ? 'grid' : 'none'
}

function switchTab(tab) {
  document
    .getElementById('tabTracker')
    .classList.toggle('active', tab === 'tracker')
  document
    .getElementById('tabGmail')
    .classList.toggle('active', tab === 'gmail')
  showView(tab === 'tracker' ? trackerView : gmailView)
  if (tab === 'tracker') setTimeout(() => scrapeCurrentPage(), 100)
}
window.switchTab = switchTab

function showToast(el, message, type) {
  el.textContent = message
  el.className = `toast show ${type}`
  if (type === 'success') setTimeout(() => el.classList.remove('show'), 3000)
}

function setStatus(state) {
  statusDot.className = `status-dot ${state}`
}

function setStorage(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res))
}
function getStorage(keys) {
  return new Promise((res) => chrome.storage.local.get(keys, res))
}
function removeStorage(keys) {
  return new Promise((res) => chrome.storage.local.remove(keys, res))
}

function formatDate(iso) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── INIT ──────────────────────────────────────────────────────────────────────
chrome.storage.local.get(
  ['token', 'email', 'gmailToken', 'gmailUserInfo', 'lastSync'],
  ({ token, email, gmailToken, gmailUserInfo, lastSync }) => {
    if (token) {
      setStatus('online')
      loggedInEmail.textContent = email || ''

      // Default to Gmail Sync tab
      showView(gmailView)
      document.getElementById('tabTracker').classList.remove('active')
      document.getElementById('tabGmail').classList.add('active')

      // Restore Gmail state if already connected
      if (gmailToken && gmailUserInfo) {
        showGmailConnected(gmailUserInfo)
        if (lastSync)
          lastSyncText.textContent = `Last synced: ${formatDate(lastSync)}`
      }
    } else {
      setStatus('offline')
      showView(loginView)
    }
  }
)

// ── LOGIN ─────────────────────────────────────────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value.trim()

  if (!email || !password) {
    showToast(loginToast, 'Please enter email and password', 'error')
    return
  }

  const btn = document.getElementById('loginBtn')
  btn.disabled = true
  btn.textContent = 'Signing in...'

  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.message || 'Login failed')

    await setStorage({
      token: data.token,
      email,
      userName: data.user?.name || email
    })
    setStatus('online')
    loggedInEmail.textContent = email

    // Default to Gmail Sync tab after login too
    showView(gmailView)
    document.getElementById('tabTracker').classList.remove('active')
    document.getElementById('tabGmail').classList.add('active')
  } catch (err) {
    showToast(loginToast, err.message || 'Login failed', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = 'Sign In'
  }
})

document.getElementById('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click()
})

// ── LOGOUT ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await removeStorage(['token', 'email', 'userName'])
  setStatus('offline')
  showView(loginView)
})

// ── SCRAPE PAGE ───────────────────────────────────────────────────────────────
function scrapeCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) return

    document.getElementById('position').placeholder = 'Detecting...'
    document.getElementById('company').placeholder = 'Detecting...'
    document.getElementById('jobLocation').placeholder = 'Detecting...'

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      })
    } catch (e) {
      console.log('Script injection:', e)
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: 'scrapeJob' },
      async (response) => {
        document.getElementById('position').placeholder =
          'e.g. Frontend Developer'
        document.getElementById('company').placeholder = 'e.g. Acme Corp'
        document.getElementById('jobLocation').placeholder = 'e.g. Toronto, ON'

        if (chrome.runtime.lastError || !response?.text) {
          scrapeBadge.style.display = 'none'
          return
        }

        scrapeBadge.textContent = '⏳ detecting with AI...'
        scrapeBadge.style.display = 'inline-flex'

        const extracted = await extractJobWithAI(response.text, response.title)

        if (extracted.position || extracted.company || extracted.jobLocation) {
          if (extracted.position)
            document.getElementById('position').value = extracted.position
          if (extracted.company)
            document.getElementById('company').value = extracted.company
          if (extracted.jobLocation)
            document.getElementById('jobLocation').value = extracted.jobLocation
          scrapeBadge.textContent = '✦ auto-detected with AI'
        } else {
          scrapeBadge.style.display = 'none'
        }
      }
    )
  })
}

// ── AI EXTRACTION ─────────────────────────────────────────────────────────────
async function extractJobWithAI(pageText, pageTitle) {
  try {
    const { token } = await getStorage(['token'])
    const resp = await fetch(`${API_BASE}/jobs/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pageText, pageTitle })
    })
    return await resp.json()
  } catch (err) {
    console.error('AI extraction failed:', err)
    return { position: '', company: '', jobLocation: '' }
  }
}

// ── SAVE JOB ──────────────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', async () => {
  const position = document.getElementById('position').value.trim()
  const company = document.getElementById('company').value.trim()
  const jobLocation = document.getElementById('jobLocation').value.trim()
  const jobType = document.getElementById('jobType').value
  const status = document.getElementById('status').value

  if (!position || !company || !jobLocation) {
    showToast(jobToast, 'Position, company and location are required', 'error')
    return
  }

  const btn = document.getElementById('saveBtn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  try {
    const { token } = await getStorage(['token'])
    const resp = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ position, company, jobLocation, jobType, status })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.message || 'Failed to save job')

    successMsg.textContent = `${position} at ${company} saved!`
    showView(successView)
  } catch (err) {
    showToast(jobToast, err.message || 'Something went wrong', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = 'Save Job'
  }
})

// ── ADD ANOTHER / CLOSE ───────────────────────────────────────────────────────
document.getElementById('addAnotherBtn').addEventListener('click', () => {
  ;['position', 'company', 'jobLocation'].forEach(
    (id) => (document.getElementById(id).value = '')
  )
  document.getElementById('jobType').value = 'full-time'
  document.getElementById('status').value = 'APPLIED'
  showView(trackerView)
  setTimeout(() => scrapeCurrentPage(), 100)
})

document
  .getElementById('closeBtn')
  .addEventListener('click', () => window.close())

// ── GMAIL: CONNECT ────────────────────────────────────────────────────────────
btnConnect.addEventListener('click', () => {
  btnConnect.disabled = true
  btnConnect.textContent = 'Connecting...'

  chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' }, async (response) => {
    console.log('Gmail auth response:', response)

    if (!response || response.error) {
      console.error('Gmail auth error:', response?.error)
      btnConnect.disabled = false
      btnConnect.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,12 2,6"/>
        </svg>
        Connect Gmail`
      return
    }

    try {
      const token = response.token
      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const profile = await profileRes.json()
      await setStorage({ gmailToken: token, gmailUserInfo: profile })
      showGmailConnected(profile)
    } catch (err) {
      console.error('Profile fetch failed:', err)
      btnConnect.disabled = false
      btnConnect.textContent = 'Connect Gmail'
    }
  })
})

// ── GMAIL: SYNC ───────────────────────────────────────────────────────────────
btnSync.addEventListener('click', async () => {
  const { token, gmailToken, gmailUserInfo } = await getStorage([
    'token',
    'gmailToken',
    'gmailUserInfo'
  ])
  if (!gmailToken || !token) {
    addLog('error', 'Not connected. Please reconnect.')
    return
  }

  setSyncing(true)
  syncLog.style.display = 'block'
  addLog('info', 'Starting Gmail sync...')

  try {
    const resp = await fetch(`${API_BASE}/gmail/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        gmailAccessToken: gmailToken,
        userEmail: gmailUserInfo?.email
      })
    })

    if (resp.status === 401) {
      chrome.identity.removeCachedAuthToken({ token: gmailToken }, () => {})
      await removeStorage(['gmailToken', 'gmailUserInfo'])
      addLog('error', 'Token expired. Please reconnect Gmail.')
      showGmailDisconnected()
      return
    }

    if (!resp.ok) throw new Error(`Server error: ${resp.status}`)

    const result = await resp.json()
    addLog('success', `Fetched ${result.processed} emails`)
    addLog('success', `Saved ${result.categorized} job-related emails`)
    if (result.skipped > 0)
      addLog('info', `Skipped ${result.skipped} already saved`)

    const now = new Date().toISOString()
    await setStorage({ lastSync: now })
    lastSyncText.textContent = `Last synced: ${formatDate(now)}`
  } catch (err) {
    addLog('error', err.message || 'Sync failed')
  } finally {
    setSyncing(false)
  }
})

// ── GMAIL: DISCONNECT ─────────────────────────────────────────────────────────
btnDisconnect.addEventListener('click', async () => {
  const { gmailToken } = await getStorage(['gmailToken'])
  if (gmailToken) {
    chrome.identity.removeCachedAuthToken({ token: gmailToken }, () => {})
    fetch(`https://oauth2.googleapis.com/revoke?token=${gmailToken}`, {
      method: 'POST'
    })
  }
  await removeStorage(['gmailToken', 'gmailUserInfo', 'lastSync'])
  showGmailDisconnected()
})

// ── GMAIL UI helpers ──────────────────────────────────────────────────────────
function showGmailConnected(profile) {
  gmailConnectSection.style.display = 'none'
  gmailSyncSection.style.display = 'block'
  gmailUserCard.style.display = 'flex'

  const name = profile.name || profile.email?.split('@')[0] || 'User'
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  gmailAvatarInitials.textContent = initials
  gmailUserName.textContent = name
  gmailUserEmail.textContent = profile.email || ''
}

function showGmailDisconnected() {
  gmailConnectSection.style.display = 'block'
  gmailSyncSection.style.display = 'none'
  gmailUserCard.style.display = 'none'
  syncLog.style.display = 'none'
  syncLog.innerHTML = ''
  lastSyncText.textContent = ''
  btnConnect.disabled = false
  btnConnect.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,12 2,6"/>
    </svg>
    Connect Gmail`
}

function setSyncing(active) {
  btnSync.disabled = active
  syncSpinner.classList.toggle('spinning', active)
  syncIcon.style.display = active ? 'none' : ''
}

function addLog(type, msg) {
  const line = document.createElement('div')
  line.className = `log-line ${type}`
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  line.innerHTML = `<span style="color:#374151">${time}</span><span class="msg"> ${msg}</span>`
  syncLog.appendChild(line)
  syncLog.scrollTop = syncLog.scrollHeight
}
