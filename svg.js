// graph 1 : projects pass / fail
function drawPassFailGraph(passed, failed) {
    const svg = document.getElementById('passfail-graph')
    const bottom = 175              // line under the bars
    const maxBar = 130              // size of the biggest bar
    const total = passed + failed
    const maxValue = Math.max(passed, failed, 1)

    const passedHeight = (passed / maxValue) * maxBar
    const failedHeight = (failed / maxValue) * maxBar

    // one bar with its number, its name and its percent
    function bar(x, value, height, label) {
        const y = bottom - height
        const percent = total ? Math.round((value / total) * 100) : 0
        return `
          <rect x="${x}" y="${y}" width="70" height="${height}" rx="8" fill="url(#grad-${label})" />
          <text class="bar-value" x="${x + 35}" y="${y - 10}" text-anchor="middle">${value}</text>
          <text class="bar-label" x="${x + 35}" y="${bottom + 22}" text-anchor="middle">${label}</text>
          <text class="bar-pct" x="${x + 35}" y="${bottom + 40}" text-anchor="middle">${percent}%</text>
        `
    }

    svg.innerHTML = `
        <defs>
            <linearGradient id="grad-PASS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
            </linearGradient>
            <linearGradient id="grad-FAIL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#fb7185" />
                <stop offset="100%" stop-color="#e11d48" />
            </linearGradient>
        </defs>

        <line class="axis" x1="20" y1="${bottom}" x2="240" y2="${bottom}" />
        ${bar(40, passed, passedHeight, 'PASS')}
        ${bar(150, failed, failedHeight, 'FAIL')}
        <text class="chart-total" x="130" y="20" text-anchor="middle">${total} projects</text>
    `
}

// add the xp one by one to get the total at each date
function calculateCumulative(transactions) {
    let total = 0
    const cumulative = []
    for (const t of transactions) {
        total = total + t.amount
        cumulative.push(total)
    }
    return cumulative
}

// graph 2 : xp over time
function drawXpOverTimeGraph(cumulative, transactions) {
    const svg = document.getElementById('xp-graph')
    const width = 640
    const height = 240
    const padLeft = 60              // space for the xp labels
    const padTop = 20
    const padBottom = 34            // space for the dates

    const maxValue = cumulative[cumulative.length - 1]

    // maxValue 0 would make every y a division by zero
    if (cumulative.length < 2 || !maxValue) {
        svg.innerHTML = `<text class="bar-label" x="320" y="120" text-anchor="middle">Not enough data yet</text>`
        return
    }

    const plotW = width - padLeft - 20
    const plotH = height - padTop - padBottom

    // position of a point inside the svg
    const xAt = (i) => padLeft + (i / (cumulative.length - 1)) * plotW
    const yAt = (value) => padTop + plotH - (value / maxValue) * plotH

    const points = cumulative.map((value, i) => `${xAt(i)},${yAt(value)}`).join(' ')
    const area = `${padLeft},${padTop + plotH} ${points} ${padLeft + plotW},${padTop + plotH}`

    // 5 lines with the xp amount on the left
    let grid = ''
    for (let i = 0; i <= 4; i++) {
        const value = (maxValue / 4) * i
        grid += `
          <line class="gridline" x1="${padLeft}" y1="${yAt(value)}" x2="${width - 20}" y2="${yAt(value)}" />
          <text class="axis-label" x="${padLeft - 10}" y="${yAt(value) + 4}" text-anchor="end">${formatXP(Math.round(value))}</text>
        `
    }

    // 5 dates under the graph
    let dates = ''
    for (let i = 0; i <= 4; i++) {
        const index = Math.round((transactions.length - 1) * (i / 4))
        dates += `<text class="axis-label" x="${xAt(index)}" y="${height - 10}" text-anchor="middle">${shortDate(transactions[index].createdAt)}</text>`
    }

    // small circles, the browser shows the title when the mouse is over
    let dots = ''
    const step = Math.max(1, Math.floor(cumulative.length / 40))
    for (let i = 0; i < cumulative.length; i += step) {
        dots += `
          <circle class="dot" cx="${xAt(i)}" cy="${yAt(cumulative[i])}" r="4">
            <title>${formatXP(cumulative[i])} on ${formatDate(transactions[i].createdAt)}</title>
          </circle>
        `
    }

    svg.innerHTML = `
        <defs>
            <linearGradient id="xp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.55" />
                <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
            </linearGradient>
        </defs>

        ${grid}
        <polygon points="${area}" fill="url(#xp-area)" />
        <polyline class="xp-line" points="${points}" />
        ${dots}
        ${dates}
    `
}

// 2021-07-26... -> Jul 21
function shortDate(date) {
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
