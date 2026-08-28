// the colors live in style.css, the markup only carries class names

// graph 1: projects pass / fail, two plain bars
function drawPassFailGraph(passed, failed) {
    const svg = document.getElementById('passfail-graph')
    const bottom = 120
    const maxBar = 90
    const max = Math.max(passed, failed, 1)

    function bar(x, value, label, kind) {
        const height = (value / max) * maxBar
        const y = bottom - height
        return `
          <rect class="bar ${kind}" x="${x}" y="${y}" width="56" height="${height}" rx="4" />
          <text class="bar-value ${kind}" x="${x + 28}" y="${y - 8}" text-anchor="middle">${value}</text>
          <text class="bar-label" x="${x + 28}" y="${bottom + 20}" text-anchor="middle">${label}</text>
        `
    }

    svg.innerHTML = `
        <line class="axis" x1="10" y1="${bottom}" x2="190" y2="${bottom}" />
        ${bar(32, passed, 'PASS', 'pass')}
        ${bar(112, failed, 'FAIL', 'fail')}
    `
}

// add the xp one by one to get the total at each date
function calculateCumulative(transactions) {
    let total = 0
    const cumulative = []
    for (const t of transactions) {
        total += t.amount
        cumulative.push(total)
    }
    return cumulative
}

// graph 2: xp over time, a plain line
function drawXpOverTimeGraph(cumulative, transactions) {
    const svg = document.getElementById('xp-graph')
    const width = 600
    const height = 200
    const padLeft = 52
    const padBottom = 24
    const top = 10

    const max = cumulative.reduce((m, v) => v > m ? v : m, 0)

    if (cumulative.length < 2 || max <= 0) {
        svg.innerHTML = `<text class="empty" x="300" y="100" text-anchor="middle">Not enough data yet</text>`
        return
    }

    const plotW = width - padLeft - 10
    const plotH = height - top - padBottom
    const baseline = top + plotH

    const xAt = i => padLeft + (i / (cumulative.length - 1)) * plotW
    const yAt = v => baseline - (v / max) * plotH

    const points = cumulative.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
    const area = `${padLeft},${baseline} ${points} ${xAt(cumulative.length - 1)},${baseline}`

    // a few xp labels on the left, each with its gridline
    let grid = ''
    for (let i = 0; i <= 4; i++) {
        const value = (max / 4) * i
        const y = yAt(value)
        grid += `
          <line class="grid-line" x1="${padLeft}" y1="${y}" x2="${width - 10}" y2="${y}" />
          <text class="tick" x="${padLeft - 10}" y="${y + 4}" text-anchor="end">${formatXP(Math.round(value))}</text>
        `
    }

    // a few dates under the graph
    let dates = ''
    for (let i = 0; i <= 4; i++) {
        const index = Math.round((transactions.length - 1) * (i / 4))
        // the first and last labels lean inwards so they stay inside the viewBox
        const anchor = i === 0 ? 'start' : i === 4 ? 'end' : 'middle'
        dates += `<text class="tick" x="${xAt(index)}" y="${height - 5}" text-anchor="${anchor}">${shortDate(transactions[index].createdAt)}</text>`
    }

    svg.innerHTML = `
        <defs>
          <linearGradient id="xp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop class="xp-stop-top" offset="0%" />
            <stop class="xp-stop-bottom" offset="100%" />
          </linearGradient>
        </defs>
        ${grid}
        <polygon class="xp-area" points="${area}" fill="url(#xp-fill)" />
        <polyline class="xp-line" points="${points}" />
        ${dates}
    `
}

// 2021-07-26... -> Jul 21
function shortDate(date) {
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
