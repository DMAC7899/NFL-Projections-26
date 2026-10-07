# NFL Projections Tool — Process for Accuracy & Stability

This is the working process for every session on this tool, built from real mistakes made and caught
this season. The goal isn't a one-time cleanup — it's a repeatable sequence so the same class of error
doesn't recur. Each rule below exists because of something that actually went wrong.

---

## 1. Data sourcing — non-negotiable

- **Stats and baselines: PFF only** (premium.pff.com, via the logged-in Chrome session). Not
  Pro-Football-Reference, not other stat sites. This was stated explicitly after PFR was tried once.
- **News/reporting: injury and availability status only.** Never used to justify a performance
  prediction or usage narrative (e.g. "will lean on the run game"). If a claim about how a player will
  *perform* isn't backed by his own real stats, it doesn't go in the baseline.
- **Real, verified data only** — never estimate, round generically, or fill a gap with a plausible-
  sounding number. If PFF doesn't have it, the flag says so; the baseline isn't invented to fill the hole.

## 2. Before touching any player's data — verify, don't assume

- **"This looks wrong" is not the same as "this is wrong."** Two real cases this season looked like bugs
  (A.J. Brown showing as NE, David Njoku showing as LAC) and were both real, correct trades. Verify with
  a search *before* "fixing" anything that looks like a data error.
- **Check for existing entries before adding a new one — including double-quoted names.** Ja'Marr Chase,
  D'Andre Swift, and De'Von Achane were each wrongly "added" as new players because a single-quote name
  search missed their existing double-quoted entries (`n:"Ja'Marr Chase"`), creating silent duplicates.
  Always grep both `n:'Name'` and `n:"Name"` before concluding a player is missing.
- **Small samples get damped, not taken at face value.** A hot 1-2 game stretch (a 100% sack-to-pressure
  rate, a 3-TD game) is real data, but it shouldn't fully overwrite an established baseline. Blend with
  a real prior; don't let one outlier game set the number.

## 3. The pre-commit validation suite — run every time, no exceptions

Every single edit to the roster or formulas gets this full sequence before it's considered done:

1. **Syntax check** — extract the `<script>` block, `node --check` it.
2. **Duplicate-name check** — `P.length` vs unique names in `P`. Any mismatch means something was
   added without checking if it already existed.
3. **Dangling-reference check** — every `partner` field must point to a name that still exists in the
   roster (a removed player can silently break another player's committee reference).
4. **Compute-failure check** — run `computeProjection` for every player with neutral opts; must be zero
   exceptions.
5. **Team-pair check** — run `computeTeamProjectedPoints` for all 32×31 real team pairings; must be zero
   failures or NaNs.
6. **Availability cross-check** — every name in `PLAYER_AVAILABILITY` and `AVAILABILITY_WEEK_OVERRIDES`
   (including `replacement` fields) must resolve to a real roster entry.

If any of these fail, the fix isn't done — it's broken in a new way.

## 4. Live-UI verification — code review is not enough

A change that looks correct in the data can still fail to reach the screen. This happened twice: a
matchup-adjustment bug that worked in isolated tests but was invisible in the real Browse view (missing
`oppAb` wiring), and a caching issue where a fix was live in source but a stale page load showed the old
behavior.

- **After any formula or wiring change, test it through the actual UI** (Playwright against the local
  file, or the live site with a hard cache-bypass) — not just a script that calls the function directly.
- **Compare a "before" and "after" state for at least one real example** so the change's direction and
  size are visibly confirmed, not assumed.
- **When checking the live site, force a genuine fresh load** (`fetch` with `cache: 'no-store'`, or a
  distinct never-used query string) before concluding something isn't deployed. A stale browser cache
  looks identical to a failed deployment.

## 5. Availability verification — mandatory before any prop, pick, or recommendation

This is the rule that exists because of a real, direct mistake: a player was recommended for a prop
after he'd already been ruled out. It cannot depend on memory or habit.

- **Before naming any player in a props/picks/betting context, check their current real status** —
  not the roster's last-known flag, a fresh check against that week's actual injury report.
- **Check every player mentioned, not just the ones already flagged as uncertain.** Both real misses
  this season (Marquise Brown, Dallas Goedert) were players who *looked* like safe, ordinary role
  players — the check has to be applied uniformly, not just to players who already seem borderline.
- **The tool's own `PLAYER_AVAILABILITY` / `AVAILABILITY_WEEK_OVERRIDES` tables are manually maintained
  and go stale.** The Betting tab shows a visible "last verified" date for exactly this reason — if
  that date isn't today (or the table hasn't been refreshed against the current injury report), treat
  it as unverified and check again before relying on it.
- **Official inactives lists** (released ~90 minutes before kickoff) are the final word — a "questionable"
  tag from earlier in the week can resolve either way.

## 6. Weekly accuracy audit — after every week's games finish

1. Pull the complete, real box score for every relevant game (full player stat lines, not just the
   3-player "leaders" boxes — those miss most of the roster).
2. Generate that week's projections directly from the live tool (`neutralOptsFor` + `computeProjection`
   for every roster player), not from memory of what was said earlier.
3. Match real names to projected names carefully (suffixes, accents, nicknames) and compute per-player
   error (actual − projected).
4. Report **MAE and signed bias**, broken out by position, not just an overall average — a position-level
   problem (e.g. QB projections having near-zero skill some weeks) is invisible in a single blended number.
5. **Investigate the largest individual misses**, don't just report them. A large miss is either normal
   game variance (a real outlier performance) or a real bug — the Sam Darnold 25-point miss in Week 3
   turned out to be an unbounded multiplier, found only by tracing every factor in his specific
   projection line by line. Don't assume "small sample" explains it without checking.
6. **Check for the same bug elsewhere** once one is found. When the Week 3 QB skill-multiplier bug was
   found, every other similarly-built multiplier in the formula was audited for the same missing-cap
   problem before moving on — that's what confirmed it was isolated, not systemic.

## 7. Calibration discipline — don't tune on the data you're testing with

- Any multiplier, weight, or damping factor tuned using a single week's results is optimistic by
  construction — say so explicitly when reporting it, and treat the next independent week as the real
  test.
- Prefer a deliberately conservative choice over the best-fit value from one week's data (e.g. choosing
  0.6 strength when the fitted optimum on that week was 0.3–0.5) specifically because one week is a small
  sample.
- Re-derive calibration constants as more weeks accumulate — pool weeks rather than re-fitting fresh
  each time, and re-check that a QB-baseline or blend-weight fix from earlier in the season is still
  reflected correctly (a QB-baseline blending bug was traced back to an earlier commit that had
  unintentionally corrupted every QB's 2025-games count).

## 8. Missing-player audit — run periodically, not just once

Three prominent players (Achane, Chase, Swift) were found missing from the main roster in the same
session, purely because they existed in supplementary PFF data tables (grades, elusive rating, coverage)
but never made it into the main `P` array that actually drives projections.

- Cross-reference every name across **all** player-keyed supplementary tables against the main roster,
  not just one table.
- Rank the misses by how many different tables mention them — a name appearing in many real tables is
  a much stronger signal of a genuine oversight than one appearing in a single table.
- **Not every miss is a bug.** Some names are correctly absent (retired, unsigned, genuinely
  replacement-level, or already handled via a season-ending removal). Check each one before adding it —
  verify current team, snap count, and role first.

## 9. Deployment — confirm, don't assume

- Every commit gets pushed to `main`; GitHub Pages auto-deploys but can lag 30–60 seconds.
- After pushing a fix that matters for an imminent decision (a live game, a betting card), **actually
  load the live URL and confirm the fix is present** — a raw `fetch` with `cache: 'no-store'` against the
  live site, plus a real functional test through the UI (not just checking that the source text contains
  the new code).
- If a check comes back looking stale, don't conclude the deploy failed — rule out browser/CDN caching
  first with a genuinely fresh load before treating it as a deployment problem.

---

## The short version

1. Source from PFF; news is for injury status only.
2. Verify before "fixing" anything that looks wrong.
3. Run the full validation suite after every change — syntax, duplicates, dangling links, compute
   failures, team-pair failures, availability cross-check.
4. Test through the real UI, not just the code.
5. Check every player's actual current status before naming them in any recommendation.
6. After each week: full box score vs. full projections, by position, investigate the outliers.
7. Don't trust a calibration number tuned on the same week it's supposed to explain.
8. Periodically sweep for players who exist in supplementary data but not the main roster.
9. Confirm live deployment directly — don't assume a push means it's visible yet.

---

## 6. Weekly cycle (added Oct 7, 2026) — in this order

1. **Scores and box scores** — ESPN scoreboard + `summary?event=<id>` for every final game (full box scores, not leader boxes).
2. **Accuracy check BEFORE any edits** — run the live tool's projections for the week just played, compare by position (MAE, signed bias, rank correlation, biggest misses). Never re-score after editing: new players and re-baselines built from that week's data make the "after" number contaminated.
3. **Missing-player scan** — every box-score player with real volume (≥3 targets, ≥5 carries, ≥10 pass attempts) must exist in `P`. Check both quote styles.
4. **Role-change scan** — compare each rostered player's observed 2026 volume (targets or carries per game) with his baseline; blend 50/50 when the gap is >35% over ≥3 games.
5. **Availability sweep** — rebuild `PLAYER_AVAILABILITY` from the CBS injury report plus at least one second source; conflicting reports become QUESTIONABLE with the conflict stated; Doubtful is treated as OUT; set `AVAILABILITY_LAST_VERIFIED` and `AVAILABILITY_FROM_WEEK`.
6. **Matchup tables** — rebuild the QB/RB/WR/TE matchup tables and Defense v Position data from ESPN box scores only (DraftEdge is no longer used anywhere).
7. **Validation suite (section 3), real-UI test, push, live-site check.**

### Added to the weekly cycle (Oct 7, 2026)
- Defence tiers (TEAMS.passD / rushD): rebuild from ESPN yards allowed per game (pass: prior season + current season; rush: 2024 + 1.5x 2025 + 1.5x current). Keep manual trade adjustments (CLE/LAR pass).
- PASS_DEF_WK1_ADJ: rebuild from the latest PFF team coverage grades; rescale to the same spread as before; check R2 vs points allowed.
- FRESH_DEF_INJURY_ADJ: delete any entry once the team has played games without those players.
- WEEKLY_CALIBRATION: refresh from the newest out-of-sample week using the engine as it was BEFORE that week's rebaseline.
- Player-card PFF badges (PFF_SKILL_GRADES_WK1, ELUSIVE_RATING_WK1): re-scrape PFF receiving (WR, TE, HB) and rushing (HB) pages.
- Before pushing: run the cross-page audit (Browse, Rankings, Slate, Big Board, Betting vs the engine, several weeks) and require zero differences.
