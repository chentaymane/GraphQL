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

// graph 2: xp over time, a line going up
function drawXpOverTimeGraph(cumulative, transactions) {
    const svg = document.getElementById('xp-graph')

    // the four edges of the drawing area, inside the 600 x 200 viewBox
    const left = 52, right = 590, top = 10, bottom = 176

    const max = Math.max(...cumulative)
    if (cumulative.length < 2 || max <= 0) {
        svg.innerHTML = `<text class="empty" x="300" y="100" text-anchor="middle">Not enough data yet</text>`
        return
    }

    // an index and an xp value become a point inside that area
    const xAt = i => left + (i / (cumulative.length - 1)) * (right - left)
    const yAt = v => bottom - (v / max) * (bottom - top)

    const points = cumulative.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')

    // 5 xp labels up the left side, each with its line across
    let rows = ''
    for (let i = 0; i <= 4; i++) {
        const y = yAt(max * i / 4)
        rows += `<line class="grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}" />
                 <text class="tick" x="${left - 10}" y="${y + 4}" text-anchor="end">${formatXP(Math.round(max * i / 4))}</text>`
    }

    // 5 dates along the bottom, the last one pulled in so it is not cut off
    let dates = ''
    for (let i = 0; i <= 4; i++) {
        const index = Math.round((transactions.length - 1) * i / 4)
        dates += `<text class="tick" x="${xAt(index)}" y="195" text-anchor="${i === 4 ? 'end' : 'middle'}">${shortDate(transactions[index].createdAt)}</text>`
    }

    svg.innerHTML = `
        ${rows}
        <polyline class="xp-line" points="${points}" />
        ${dates}
    `
}

// 2021-07-26... -> Jul 21
function shortDate(date) {
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
