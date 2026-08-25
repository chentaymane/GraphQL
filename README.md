# GraphQL Profile

A small dashboard that logs into the Zone01 Oujda platform and shows your own
school profile: XP, level, audit ratio, success rate, projects and skills.

Everything is queried live from the school GraphQL endpoint. There is no
backend, no framework and no build step — just three JavaScript files.

## Run it

Open `index.html` in a browser and log in with your platform username (or
email) and password.

## Files

| File | What it holds |
|------|---------------|
| `index.html` | The login form and the profile layout |
| `style.css` | All the styling |
| `auth.js` | Login, logout and reading the JWT |
| `querys.js` | The GraphQL queries and the DOM updates |
| `svg.js` | The two graphs, drawn by hand in SVG |

The three scripts are loaded at the end of `index.html`. They share plain global
functions, so `querys.js` can call `getUserIdFromToken()` from `auth.js` and
`drawXpOverTimeGraph()` from `svg.js` without any import.

## auth.js — getting in

`Login()` reads the two inputs and sends them to the `signin` endpoint as a
Basic auth header:

```js
'Authorization': `Basic ${toBase64(`${email_user}:${password}`)}`
```

`toBase64()` exists because `btoa()` only accepts latin1 characters. The
password is encoded to UTF-8 bytes first, so an accent or an emoji in a password
does not throw.

The endpoint answers with a JWT. It is stored in `localStorage`, then
`showProfile()` hides the login form and `loadProfile()` fills the page.

A JWT is three parts separated by dots. The middle one is base64 JSON, and it
holds the user id (`sub`) and the expiry (`exp`). `getTokenPayload()` decodes
it, and it is used twice:

- `getUserIdFromToken()` for the query that needs a user id
- the check at the bottom of the file, which logs you out if the token has
  expired instead of letting every query fail with a 401

`Logout()` removes the token and reloads the page.

## querys.js — the data

### The helpers

`queryGraphQL(query, variables)` is the only place that talks to the network.
It attaches the JWT as a `Bearer` token, posts the query, and throws if the
answer contains an `errors` array — GraphQL returns HTTP 200 even when the query
failed, so checking `response.ok` would not be enough.

The rest are small and shared:

- `formatXP()` turns raw XP into the platform's units: `665 kB`, `1.62 MB`.
  kB is rounded, MB keeps two decimals, which is how the site itself shows them.
- `formatDate()` — `2021-07-26...` becomes `26 Jul 2021`.
- `setText()` writes into an element by id.
- `setAvatar()` sets the picture, or removes the `src` when the user has none.
- `escapeHtml()` — several lists are built as HTML strings, so any name coming
  from the API goes through this first.
- `bestByName()` collapses rows to the best amount per name.
- `barRow()` builds the "name ..... value" line with its bar, shared by the top
  projects and the skills.

### The queries

Seven functions, each one query, each one wrapped in its own `try / catch` so a
single failure only blanks its own card instead of the whole page.

| Function | What it fills |
|----------|---------------|
| `getUserInfo()` | Name, login, email, campus, avatar |
| `getLevel()` | The module level |
| `getXp()` | Total XP and the XP graph |
| `getProjects()` | Success rate, PASS/FAIL graph, recent activity |
| `getAuditRatio()` | Ratio, up/down totals, the small bar |
| `getTopProjects()` | The 8 best projects by XP |
| `getSkills()` | The 8 best skills |

They cover the three kinds of query asked for:

- **normal query** — `getUserInfo()` reads the `user` table
- **query with arguments** — `getLevel()` passes the user id from the JWT as a
  GraphQL variable (`$userId: Int!`)
- **nested query** — `getTopProjects()` goes `transaction -> object`, and
  `getProjects()` goes `progress -> object`

### Things that are easy to get wrong

**XP is filtered.** A plain `type: "xp"` filter also returns piscine XP, which
the platform does not count in your profile total. Both the total and the graph
filter on `event: { object: { name: { _eq: "Module" } } }`.

**The total and the graph come from the same rows.** `getXp()` fetches the
transactions once, sums them into a cumulative array, and uses the last value as
the total. The number on the card is literally the last point of the curve, so
the two cannot drift apart.

**`progress` has one row per attempt.** A project you failed twice and then
passed is three rows. The success rate keeps only the newest row of each
project — the query orders by `updatedAt: desc`, and a `Set` of object ids skips
everything already seen. Without this, old retries count as failures and the
rate comes out far too low. The recent activity list, on the other hand, uses
every row, because there it is a feed and repeats are the point.

**A project can have several XP transactions.** Listing them raw shows the same
project twice, so `getTopProjects()` runs them through `bestByName()`. The rows
are already sorted by amount, so the first time a name appears is its best
value. `getSkills()` does the same on `skill_go`, `skill_js` ...

**Logging in does not reload the page.** `Login()` just unhides the profile and
refetches, so `loadProfile()` starts with `resetProfile()`, which blanks every
field, both graphs and the three lists. Without it, anything the new user has no
value for keeps showing the previous user's data.

## svg.js — the graphs

Both graphs are built as SVG strings and dropped into an empty `<svg>` element.
No chart library.

`drawXpOverTimeGraph()` takes the cumulative array and maps it to coordinates
with two small functions, `xAt(i)` and `yAt(value)`. It draws five gridlines
with their XP labels, a filled area under the line, the line itself, and a dot
every few points carrying a `<title>` so the browser shows the amount and date
on hover. It bails out with "Not enough data yet" when there are fewer than two
points, or when the total is zero — that would make every `yAt()` a division by
zero.

`drawPassFailGraph()` draws two bars scaled to the bigger of the two values,
each with its count, its label and its percentage.

## Notes

- The JWT sits in `localStorage`, so any script on the page could read it. Fine
  for a school project, not for anything real.
- The queries rely on the endpoint's row-level permissions to return only your
  own rows, which is why most of them carry no user filter.
