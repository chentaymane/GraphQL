// graph 1: projects pass / fail, two plain bars
function drawPassFailGraph(passed, failed) {
    const svg = document.getElementById('passfail-graph')
    const bottom = 120
    const maxBar = 90
    const max = Math.max(passed, failed, 1)

    const passH = (passed / max) * maxBar
    const failH = (failed / max) * maxBar

    function bar(x, value, height, label, color) {
        const y = bottom - height
        return `
          <rect x="${x}" y="${y}" width="60" height="${height}" fill="${color}" />
          <text x="${x + 30}" y="${y - 6}" text-anchor="middle" fill="#eee">${value}</text>
          <text x="${x + 30}" y="${bottom + 16}" text-anchor="middle" fill="#aaa">${label}</text>
        `
    }

    svg.innerHTML = `
        <line x1="10" y1="${bottom}" x2="190" y2="${bottom}" stroke="#555" />
        ${bar(30, passed, passH, 'PASS', '#4ade80')}
        ${bar(110, failed, failH, 'FAIL', '#f87171')}
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
    const padLeft = 50
    const padBottom = 24
    const top = 10

    const max = cumulative.reduce((m, v) => v > m ? v : m, 0)

    if (cumulative.length < 2 || max <= 0) {
        svg.innerHTML = `<text x="300" y="100" text-anchor="middle" fill="#aaa">Not enough data yet</text>`
        return
    }

    const plotW = width - padLeft - 10
    const plotH = height - top - padBottom

    const xAt = i => padLeft + (i / (cumulative.length - 1)) * plotW
    const yAt = v => top + plotH - (v / max) * plotH

    const points = cumulative.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')

    // a few xp labels on the left
    let grid = ''
    for (let i = 0; i <= 4; i++) {
        const value = (max / 4) * i
        grid += `<text x="${padLeft - 8}" y="${yAt(value) + 4}" text-anchor="end" fill="#aaa" font-size="11">${formatXP(Math.round(value))}</text>`
    }

    // a few dates under the graph
    let dates = ''
    for (let i = 0; i <= 4; i++) {
        const index = Math.round((transactions.length - 1) * (i / 4))
        dates += `<text x="${xAt(index)}" y="${height - 6}" text-anchor="middle" fill="#aaa" font-size="11">${shortDate(transactions[index].createdAt)}</text>`
    }

    svg.innerHTML = `
        ${grid}
        <polyline points="${points}" fill="none" stroke="#d9e021" stroke-width="2" />
        ${dates}
    `
}

// 2021-07-26... -> Jul 21
function shortDate(date) {
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
