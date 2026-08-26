//  HELPERS 

// send a query to the graphql endpoint
async function queryGraphQL(query, variables = {}) {
  const token = localStorage.getItem('jwt')
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  })

  const result = await response.json()

  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    throw new Error(result.errors[0].message)
  }

  return result.data
}

// 1000 xp -> 1 kB (665 kB, but 1.62 MB : kB is rounded, MB keeps 2 decimals)
function formatXP(xp) {
  if (xp >= 1000000) return (xp / 1000000).toFixed(2) + ' MB'
  if (xp >= 1000) return Math.round(xp / 1000) + ' kB'
  return xp + ' B'
}

// 2021-07-26... -> 26 Jul 2021
function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// put a text inside an element
function setText(id, value) {
  document.getElementById(id).textContent = value
}

// a name coming from the api must never be trusted inside innerHTML
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// keep the best amount of each name
// (the rows are sorted by amount desc, so the first one of a name is its best)
function bestByName(rows, nameOf) {
  const best = {}
  for (const row of rows) {
    const name = nameOf(row)
    if (!best[name]) best[name] = row.amount
  }
  return best
}

// one "name ..... value" line with its bar, used by the projects and the skills
function barRow(name, value, percent) {
  return `
    <div class="row">
      <span class="name">${escapeHtml(name)}</span>
      <span class="value">${value}</span>
    </div>
    <div class="track"><span style="width:${percent}%"></span></div>
  `
}

// ------------------------------------------------------------------------------------
//  QUERIES 

// user identification and avatar (normal query)
async function getUserInfo() {
  const query = `
  {
    user {
      id
      login
      firstName
      lastName
      email
      campus
      createdAt
      avatarUrl
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const user = data.user[0]
    if (!user) throw new Error('no user returned')

    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()

    setText('login', user.login)
    setText('fullname', name)
    setText('info-id', user.id)
    setText('info-login', user.login)
    setText('info-name', name || '-')
    setText('info-email', user.email || '-')
    setText('info-campus', user.campus || '-')
    setText('info-since', formatDate(user.createdAt))
    if (user.avatarUrl) document.getElementById('avatar').src = user.avatarUrl
  } catch (err) {
    console.error('Failed to load user info:', err)
  }
}

// module level (query with a variable, the id comes from the jwt)
// scoped to the Module event like the XP, otherwise a piscine level
// transaction can win the `order_by amount desc` and show the wrong number
async function getLevel() {
  const query = `
  query ($userId: Int!) {
    transaction(
      where: {
        type: { _eq: "level" }
        userId: { _eq: $userId }
        event: { object: { name: { _eq: "Module" } } }
      }
      order_by: { amount: desc }
      limit: 1
    ) {
      amount
    }
  }
  `
  try {
    const data = await queryGraphQL(query, { userId: getUserIdFromToken() })
    setText('level', data.transaction.length ? data.transaction[0].amount : '-')
  } catch (err) {
    console.error('Failed to load level:', err)
  }
}

// total xp, and the xp graph
// the total is summed from the same rows the graph draws, so the number on the
// card and the last point of the curve can never disagree
async function getXp() {
  const query = `
  {
    transaction(
      where: { type: { _eq: "xp" }, event: { object: { name: { _eq: "Module" } } } }
      order_by: { createdAt: asc }
    ) {
      amount
      createdAt
    }
  }
  `
  try {
    const transactions = (await queryGraphQL(query)).transaction
    const cumulative = calculateCumulative(transactions)
    const total = cumulative.length ? cumulative[cumulative.length - 1] : 0

    setText('xp', formatXP(total))
    setText('xp-raw', `${total} XP in ${transactions.length} transactions`)
    drawXpOverTimeGraph(cumulative, transactions)
  } catch (err) {
    console.error('Failed to load XP:', err)
  }
}

// projects : success rate, the pass/fail graph and the recent activity
// progress has one row per attempt, so the counts keep only the newest row of
// each project, otherwise a retry you eventually passed still counts as a fail
async function getProjects() {
  const query = `
  {
    progress(
      where: { object: { type: { _eq: "project" } } }
      order_by: { updatedAt: desc }
    ) {
      grade
      updatedAt
      object {
        id
        name
      }
    }
  }
  `
  const list = document.getElementById('recent')
  try {
    const rows = (await queryGraphQL(query)).progress
    const seen = new Set()
    let passed = 0
    let failed = 0
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];

    if (seen.has(p.object.id)) continue
    if (p.grade === null) {
      rows.splice(i--, 1)
      continue
    }
    seen.add(p.object.id)
    if (p.grade >= 1) passed++
    else failed++
  }

    const total = passed + failed
    setText('success-rate', total ? ((passed / total) * 100).toFixed(1) + '%' : '-')
    setText('passfail', `${passed} passed / ${failed} failed`)
    drawPassFailGraph(passed, failed)

    // the activity feed shows every attempt, newest first
    list.innerHTML = rows.slice(0, 10).map(p => {
      
      const pass = p.grade >= 1
      return `
        <li class="activity">
          <span class="badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>
          <span class="name">${escapeHtml(p.object.name)}</span>
          <span class="muted small">${formatDate(p.updatedAt)}</span>
        </li>
      `
    }).join('') || '<li class="muted small">No activity yet</li>'
  } catch (err) {
    list.innerHTML = '<li class="muted small">No activity yet</li>'
    console.error('Failed to load projects:', err)
  }
}

// audits : xp given (up) and xp received (down)
async function getAuditRatio() {
  const query = `
  {
    up: transaction_aggregate(where: { type: { _eq: "up" } }) {
      aggregate { count sum { amount } }
    }
    down: transaction_aggregate(where: { type: { _eq: "down" } }) {
      aggregate { count sum { amount } }
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const up = data.up.aggregate.sum.amount || 0
    const down = data.down.aggregate.sum.amount || 0
    const ratio = down ? up / down : null
    const diff = up - down

    setText('audit', ratio === null ? '-' : ratio.toFixed(2))
    // the platform shows the ratio then the difference, eg "1.71 + 12 kB"
    setText('audit-sub', `${diff >= 0 ? '+' : '-'} ${formatXP(Math.abs(diff))}`)
    setText('audit-up', formatXP(up))
    setText('audit-down', formatXP(down))
    setText('audit-up-count', data.up.aggregate.count)
    setText('audit-down-count', data.down.aggregate.count)

    // green part of the small bar
    const share = up + down ? (up / (up + down)) * 100 : 50
    document.getElementById('ratio-fill').style.width = share + '%'
    setText('audit-note', ratio >= 1 ? 'Good ratio, keep it up.' : 'Audit more projects to raise your ratio.')
  } catch (err) {
    console.error('Failed to load audit ratio:', err)
  }
}

// best projects (nested query : transaction -> object)
async function getTopProjects() {
  const query = `
  {
    transaction(
      where: { type: { _eq: "xp" }, object: { type: { _eq: "project" } } }
      order_by: { amount: desc }
    ) {
      amount
      object {
        name
      }
    }
  }
  `
  const list = document.getElementById('top-projects')
  try {
    const data = await queryGraphQL(query)

    // a project can have several xp transactions, keep the best one of each
    const best = bestByName(data.transaction, t => t.object.name)
    const names = Object.keys(best).slice(0, 8)

    if (!names.length) {
      list.innerHTML = '<li class="muted small">No project yet</li>'
      return
    }

    const max = best[names[0]]
    list.innerHTML = names
      .map(name => `<li>${barRow(name, formatXP(best[name]), (best[name] / max) * 100)}</li>`)
      .join('')
  } catch (err) {
    list.innerHTML = '<li class="muted small">No project yet</li>'
    console.error('Failed to load top projects:', err)
  }
}

// skills, the type looks like skill_go, skill_js ...
async function getSkills() {
  const query = `
  {
    transaction(where: { type: { _like: "skill_%" } }, order_by: { amount: desc }) {
      type
      amount
    }
  }
  `
  const box = document.getElementById('skills')
  try {
    const data = await queryGraphQL(query)

    const best = bestByName(data.transaction, t => t.type.replace('skill_', ''))
    const names = Object.keys(best).slice(0, 8)

    if (!names.length) {
      box.innerHTML = '<p class="muted small">No skill yet</p>'
      return
    }

    box.innerHTML = names
      .map(name => `<div class="skill">${barRow(name, best[name] + '%', best[name])}</div>`)
      .join('')
  } catch (err) {
    box.innerHTML = '<p class="muted small">No skill yet</p>'
    console.error('Failed to load skills:', err)
  }
}

// load everything
function loadProfile() {
  getUserInfo()
  getLevel()
  getXp()
  getProjects()
  getAuditRatio()
  getTopProjects()
  getSkills()
}

if (localStorage.getItem('jwt')) {
  window.addEventListener('load', loadProfile)
}
