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

## Offence-side refresh and Betting team model (added Oct 7, 2026)
- OL: scrape PFF T/G/C run-block grade and pass-block GRADE (not the EFF column), blend 17:4, rescale to old mean/sd, write olRunGrade/olPbe in TEAMS.
- QB_ATT_COMP: ESPN box scores per QB (att, comp, games); blend with 2025 by 2026 games/(17+games); skip 1-game samples.
- Betting team points: base (win totals + PFF grades) x engine matchup factor (half weight, +/-12%) x injury factor (60% pass-through, floor 0.80) via teamEngineAdjustment(). Weekly: refresh availability overrides first, then re-run the Weeks 1-4 backtest (backtest uses ESPN scoreboard scores) to confirm error did not rise.

## Defensive rosters and injuries (added Oct 7, 2026)
- DEF_ROSTER: PFF /nfl/positions/{yr}/REGPO/defense?position=ED|DI|LB|CB|S for 2025 and 2026 (50 rows per page, click NEXT); blend DEF grade by snaps with a 150-snap prior of 60; keep top 3 ED/DI/LB, 4 CB, 3 S by 2026 snaps per game.
- DEF_AVAILABILITY: ESPN injuries API (site.api.espn.com/apis/site/v2/sports/football/nfl/injuries), defensive positions only, statuses Out/IR/Doubtful/Questionable, matched by name per team. Refresh every Friday and remove expired entries.
- defenderInjuryFactors() converts missing defenders into pass/run multipliers used by the engine and team points. Check the team table for sanity (star edge out is about +0.5 to +1 point allowed).

## Scheduled injury / trade runs (added Oct 8, 2026)
Run by scheduled tasks. Sources allowed for these runs: espn.com (injuries API site.api.espn.com/apis/site/v2/sports/football/nfl/injuries, transactions, team pages) and nfl.com only. If a fact is not on one of those, do not use it.
1. Pull ESPN injuries for all 32 teams. Offence: update PLAYER_AVAILABILITY / AVAILABILITY_WEEK_OVERRIDES for players in the roster P (OUT = out/IR/PUP, BACKUP = healthy but not starting, QUESTIONABLE = questionable; doubtful maps to OUT only if ESPN/NFL.com say out). Defence: rebuild DEF_AVAILABILITY for players in DEF_ROSTER (OUT/IR, DOUBTFUL, QUESTIONABLE). Remove entries for players now healthy or no longer listed. Set AVAILABILITY_LAST_VERIFIED to today.
2. Trades / signings / releases (ESPN transactions, NFL.com transactions): if a rostered player moved teams, update his t field and flag it; do not invent a role. A move that needs a judgement call (new baseline, role) is listed in the commit message under "NEEDS REVIEW" and left unchanged.
3. Run: node tools/validate.js (must print ALL OK) and node tools/audit.js (0 diffs, no page errors). If either fails, do not push; fix or revert.
4. Commit with a message listing what changed (players and statuses), push to main.

## QB 2026 game log (added Oct 9, 2026)
- QB_2026_LINES: ESPN box scores (scoreboard seasontype=2&week=N&dates=2026 then summary?event=ID, boxscore.players passing: C/ATT, YDS, TD, INT) summed per QB; eq = attempts/30; per-game-equivalent yards/TD/INT. Blended into getBlendedBaseline at QB_2026_WEIGHT 2.5 (backtest-picked). Refresh weekly with the new week's box scores.
- The pressure-to-sack skill multiplier weight is 0.03 (test slope -0.049 +/- 0.043); re-test with more weeks (script: regress actual-vs-baseline pass yards on the P2S gap).

## QB rushing vs run defence (DEF_RUN_LEAK)
QB rush yards now scale by the opponent's real rushing leak (all rushers' yards per carry allowed vs league, ESPN box scores). Refresh `DEF_RUN_LEAK` weekly ([games, rush yds allowed, carries allowed] per defence) and re-test: slope of actual/expected QB rush on leak (leave-one-game-out). Wk1-4: ypc leak slope 0.64 (se 0.52); QB-specific rush-yards-allowed had no signal (-0.12) so is not used. Same weekly re-test of RB/WR/TE matchup strength (Wk1-4 slopes: RB rush 0.92, WR rec 0.61, TE rec 1.00).

### RB rushing: real run-leak test (Wk1-4, not adopted)
Tested adding each defence's real non-QB ypc allowed (leave-one-game-out) on top of the existing rush tier + grade adjustment: incremental slope -0.31 (se 0.25, 158 RB games) = no extra signal, so RBs are NOT given a leak factor (QBs are, see above). Per-defence actual/projected RB rush (Wk1-4): TB 1.07 (RBs beat projection vs TB), lowest WSH 0.55, JAX 0.59, ATL 0.67; highest DET 1.52, CLE 1.35, LAC 1.30. Re-test each week as samples grow.

## Role-change corrections (ROLE_2026 / RECV_2024_EXCLUDE) -- preview branch role-2026-preview
For RB/WR/TE whose real 2026 role differs sharply from the preseason line (Wk1-4: Godwin, Egbuka, Gainwell), `ROLE_2026` blends per-game ESPN lines 4:6 with the prior; `RECV_2024_EXCLUDE` skips the 2024 blend (Godwin). Refresh weekly from box scores and delete entries once the baseline catches up. A blanket 2026 layer for all skill players was tested and did NOT help (406 player-games). Note ESPN name variants (Kenny Gainwell, Chris Godwin Jr.) when matching box scores.

## Week-6 cycle notes (Oct 14, 2026)
Every PFF set is refreshed each week, not only ESPN data. Checklist run this cycle:
1. ESPN: box scores (Weeks 1-5), injuries merged from BOTH ESPN feeds (offence and defence), DvP tables, QB lines, run-leak, role fixes.
2. PFF (signed-in Chrome, innerText of the kyber tables, passed through sessionStorage in ~1000-char chunks with a checksum `(h*31+code)%1000003`): defender grades -> `DEF_ROSTER`; team offence/defence grades and regressions -> `PFF_TEAM_*_WK4`, `PFF_*_REGRESSION`; OL pass-block/run-block -> TEAMS `olPassMult/olRunMult`; coverage grades -> `PASS_DEF_WK1_ADJ`; skill grades -> `PFF_SKILL_GRADES_WK1`, `ELUSIVE_RATING_WK1`.
3. Defender availability: `DEF_AVAILABILITY` rebuilt from the injury feeds (OUT 1, DOUBTFUL 0.75, QUESTIONABLE 0.2 weights, 10% cap). Measured effect on Week 6 offence is small (mean 0.3 yd per player, max about 2 yd / 0.3 PPR points).
4. Man/zone: man rate = PFF man-coverage snaps / ALL coverage snaps (every CB, S, LB), for BOTH years, blended with 2025 at g/(g+8). Do not mix with man/(man+zone). The Oct 7 table did, which overstated 2026 man rates by about 30%; fixed Oct 14.
5. Pressure = sack rate, 2025 blended with 2026 at dropbacks/(dropbacks+600). ttt and c0-c4 shells are NOT refreshed (only allowed source is FTN, not pulled this cycle).
6. Scheme-vs-targeting cross-check (Weeks 1-5, n=32 defences): team man rate, shell rates and pressure show no usable relationship with TE/RB/WR target share or yards per target (|r| mostly < 0.2; 0.35 needed for p<.05). The one player-level signal that holds: man-beaters gain about 9 yd/game against high-man defences vs low-man (+2.6 vs -6.3 against their own leave-one-out average), matching the engine's +14%/-10% layer. Zone-beaters show no edge (+1.2 vs -0.7, wrong direction, noise). Engine unchanged. Re-run each week as samples grow.

## Methodology text lives in the back end only (Oct 14, 2026)
The "Data & methodology" panels were removed from every page of the site at the user's request. The removed wording is archived in `site-methodology-notes.md`; this file and the code comments are the method record. Do not add explanatory panels back to the UI.

## Per-player prior override (Oct 14, 2026)
`ROLE_2026_PRIOR_G_OVERRIDE` lets one player's 2026 role line carry more weight than the global 6 prior games. Brock Bowers = 4 (2026 share 3/9 to 3/7) on 2.79 YPRR and 11.7 targets/game. Not back-tested; revisit after Week 7.

## Defense v Position tab (Oct 14, 2026)
`DVP_2026` is refreshed every week from the ESPN box scores (positions from ESPN, per game played): qb = QB passing yards allowed per game, wr/te = receiving yards, rb = RB rushing yards only, rbrec = RB receiving yards only (kept separate from Oct 14, never combined). QB column added Oct 14. It was still on Weeks 1-4 until this refresh, so add it to the weekly checklist.

## Removed players (Oct 14, 2026)
At the user's request these QBs were removed from the tool entirely (roster rows, their data-table entries and availability lines): Tyson Bagent, Cooper Rush, Drew Lock, Shedeur Sanders, Athan Kaliakmanis, Carson Wentz. Do not re-add them in weekly scans.

## Friday injury refresh method (Oct 16, 2026)
Pull ESPN `injuries` for all 32 teams, drop rows with status Active, and merge into the existing tables: a listed player is replaced by the new row, a player now Active is removed, and a player the feed omits is kept ONLY if the team roster endpoint still shows him on injured reserve (long-term IR players are missing from the injuries feed). Healthy-backup rows stay. Doubtful offensive players are counted as QUESTIONABLE with the conflict stated in the note (house rule), so check any doubtful QB by hand: Mayfield (TB) and Mariota (WAS) were doubtful on Oct 15. Also scan ESPN transactions since the last run for rostered players (this run: Jared Wayne waived by HOU, claimed by MIA; A.J. Brown designated to return from IR Oct 14).

## Week-7 cycle notes (Oct 21, 2026)
Same checklist as Week 6, plus these lessons:
1. Week 6 accuracy (live engine before edits, played players only): residual PPR bias (proj - actual) QB +0.80 (n=26), RB +0.04 (n=50), WR +0.60 (n=86), TE +0.23 (n=39, not calibrated). WEEKLY_CALIBRATION now 5 weeks of data: qbMult 0.9839, rbMult 0.9835, wrMult 0.9650.
2. ESPN rebuilds (every one reproduced the Oct 14 values first): DvP, run-leak, tiers, the four *_MATCHUP_ADJ tables (damps cut to QB 0.20, RB 0.25, WR 0.50, TE 0.60 because the Week 6 slopes weakened), QB lines and att/comp, ROLE_2026, line-only players (re-averaged over team games; the 5 with no box rows are left unchanged), 8 players added after Mike Washington Jr.
3. PFF: defender grades (DEF_ROSTER blend), team grades and regressions, OL multipliers, skill grades, elusive ratings, PFF_QB (OFF/PASS grades, BTT%, TWP%, games; it had not been refreshed since Week 2).
4. Coverage scrape recipe (premium.pff.com defense-coverage-scheme?position=CB|S|LB, 50 rows per page, click NEXT): stats row = [#, POS, G, TEAM, COV total, MAN%, man snaps, ...]; team man rate = sum(man snaps) / sum(COV total) over CB+S+LB. USE 2025 /REG/ (regular season only). The 2025 REGPO page includes playoff snaps and moved CHI (1752 vs 1492 CB snaps) and others. 2025 is REG, 2026 is REGPO (no playoffs yet). The weekly mean man rate moved from 0.221 to 0.247 because both years were re-pulled like for like; coverage effects use the difference from LEAGUE_AVG_MAN so the level shift is neutral.
5. Pressure: the 2025 base is backed out of the previous value, p25 = (old - w5*p26_wk5) / (1 - w5), then re-blended with Weeks 1-6 at dropbacks / (dropbacks + 600).
6. Injuries: ESPN injuries feed + roster endpoint (match names with suffixes and punctuation stripped: Deebo Samuel Sr., James Cook III, Travis Etienne Jr., DJ Moore; team code WSH vs WAS). Healthy-backup QB rows are kept and their notes re-written. Transactions since Oct 14: Slayton released (IND), Shipley IR (PHI), Doubs IR (NE), Skyy Moore IR (GB), Roman Wilson IR (PIT), Kaytron Allen claimed by MIA.
7. NEEDS REVIEW (left unchanged): Jalen Hurts is on IR (ESPN return date 2027-02-15); Tanner McKee started Week 6 (26/45, 215 yd, 1 TD, 3 sacks) but is not in the tool and PFF shows only 49 dropbacks (OFF 70.9) so no QB-swap override is applied to PHI team points. Najee Harris (NYG) and Jonathan Brooks (CAR) are on no ESPN roster and no recent transaction shows why; their old entries are kept. Kaytron Allen's t field was moved WAS to MIA (claimed Oct 9); his role there is unverified.
8. Open items: Surtain grade override, Harrison role update, touchdown-share layer, Saturday morning injury re-run.

## Week-8 cycle notes (Oct 28, 2026)
Same checklist as Week 7 (ESPN rebuilds, then every PFF set, then injuries). Results and lessons:
1. Week 7 accuracy (live engine as published Oct 21, played players only): residual PPR bias (proj - actual) QB -0.23 (n=27), RB -1.39 (n=51), WR +1.26 (n=83), TE +0.35 (n=39, not calibrated). WEEKLY_CALIBRATION now 6 weeks of data: qbMult 0.9844, rbMult 0.9878, wrMult 0.9607 (same 20% damping, scaled by 1/6).
2. Matchup damps refit on pooled weeks 2-7: QB 0.30, RB 0.30, WR 0.50, TE 0.50 (slopes 0.29 / 0.30 / 0.52 / 0.49; Week 7 alone 0.99, 0.64, 0.57, -0.19). Last week's cut (after Week 6 turned negative) was too much; one week is not a trend, so refit on the pool and keep the weakening visible in the comment.
3. ROLE_2026 has 27 entries (Corum, Chase and Schultz added under the same volume-gap rule; not back-tested). Example change in Week 8 projections: Blake Corum LAR vs LAC 5.7 -> 8.6 PPR (rush attempts 5.7 -> 7.7, rush yards 25.9 -> 40.0).
4. PFF sets refreshed through Week 7: DEF_ROSTER, team grades and both regressions (def a -0.297 b 42.10 R2 0.30; off a 0.428 b -7.59 R2 0.58), PASS_DEF_WK1_ADJ (same formula, sd 0.0217), OL multipliers (re-expressed on the same mean/sd; formula repro error 0.005 pass / 0.06 run), PFF_QB, skill grades, elusive ratings, coverage man rates and pressure (LEAGUE_AVG_MAN 0.2476, LEAGUE_AVG_PRESSURE 0.0663).
5. PFF page notes: the team page is premium.pff.com/nfl/teams/2026/REGPO (columns: record, PF, PA, OVR, OFF, PASS, PBLK, RECV, RUN, RBLK, DEF, RDEF, TACK, PRSH, COV, ST). The receiving page with position=HB returns every position, so filter to HB/FB rows. HB rushing page: att = column 5 (not 4), mtf = column 16, ELU = column 37. OL pages: column 7 = run-block snaps, 8 = pass-block snaps, 10 = run grade, 11 = pass grade; ol.txt rows are [run snaps, run snaps x grade, pass snaps, pass snaps x grade, players]. Pass the data to the container through get_page_text of a <pre> block, never javascript_tool output (about 1000 characters, and query-string-looking text is blocked).
6. Lesson: save the raw PFF pulls to disk as you go (the 2025 defence crawl had to be redone because it was never saved).
7. Injuries: ESPN feeds rebuilt on Oct 28 (PLAYER_AVAILABILITY, DEF_AVAILABILITY, AVAILABILITY_LAST_VERIFIED). NEEDS REVIEW: J.J. McCarthy (NYG, 3 games, PFF 80.8) and Tanner McKee (PHI, 2 games) are the actual starters but are not in the tool; Najee Harris (NYG), Jonathan Brooks (CAR) and Darius Slayton (IND) are on no ESPN roster and their rows are kept; Case Keenum is ESPN Out and stays BACKUP; Brashard Smith (KC) and Tyler Badie (DEN) are on IR and not in the tables.
8. Open items (not started): Surtain grade override, Harrison role update, touchdown-share layer, Saturday morning injury re-run, adding McCarthy/McKee, review of the big Week 7 misses (Pollard, Coker, Mahomes).

## Open-items review (Oct 28, 2026, after the Week 8 refresh)
1. **Touchdown-share layer: tested, NOT adopted.** Back-test on Weeks 6 and 7 (348 non-QB player-games): the engine's own TD projection correlates 0.20 with actual TDs (MAE 0.42); a trailing share-of-team-TDs predictor correlates 0.12 (MAE 0.43); blending 25% / 50% of it in lowers the correlation (0.19 / 0.17). Team totals are already calibrated (Week 7: 57.7 projected vs 60 actual rushing + receiving TDs). Re-test when 10+ weeks exist.
2. **Week 7 misses are TD-driven, not volume-driven.** Under-projected: Pollard (25 car, 129 yd, 3 TD = 36.5), Caleb Douglas (3 tgt, 2 TD = 21.0), Mason Taylor (2 TD on 6 tgt), Jameson Williams (2 TD), Malik Willis (3 TD). Over-projected: Collins (5 tgt, 6 yd), Henry, Walker, Mahomes (165 yd, 1 INT), Coker (4 tgt, 9 yd) -- shortfalls in yards with no TD. No fix needed; this is TD variance.
3. **Surtain grade override: not applied.** PFF 2026 grade 51.8 over 4 games / 244 snaps; 2025 72.0 over 864 snaps; the 150-snap prior blend gives 66.6 (shown as 67). That is already the shrunk number; raising it back to 72 would be a hand override with no stats behind it. He is QUESTIONABLE (ankle). Revisit when he has 8+ games.
4. **Harrison role update: not applied.** 2026 targets by game (ARI 3, 1, 5, 4; HOU 4, 4) average 3.5 vs the 4.7 baseline (-26%, below the 35% rule); yards 20.8 per game vs 39.1 are efficiency, not volume. A ROLE_2026 line would move his target projection about 0.6.
5. **McCarthy and McKee added; Winston set to BACKUP.** McCarthy started NYG Weeks 6-7 (Winston did not play Week 7, ESPN shows no injury); McKee started PHI Weeks 6-7 (Hurts on IR). Baselines: McCarthy PFF 2025 (10 games, 243 att, 1,632 yd, 11 TD, 12 INT) + 2026 lines; McKee a 190 yd starter prior (same as Huntley) + 2026 lines. Week 8: Winston 14.1 PPR (starter) -> BACKUP; McCarthy 10.2; McKee 11.7.
6. **Bias trend (proj - actual, PPR):** QB +0.89 / -2.03 / +0.80 / -0.23 (Weeks 4-7, sign flips = noise); RB -2.03 / -0.13 / +0.04 / -1.39; WR -0.35 / +0.59 / +0.60 / +1.26 (drifting to over-projection); TE +0.51 / +0.23 / +0.35 (three weeks over-projected, not yet calibrated). Week 7 correlation of projection with actual: QB 0.13, RB 0.53, WR 0.50, TE 0.21.

## Week Board and tab clean-up (Oct 28, 2026)
- Removed the Big Board and Rankings tabs (their fantasy PPR lists duplicated Browse). Browse, Compare and Best Matchups still show fantasy PPR.
- "Weekly Slate" became "Week Board" (data-mode `slate`, `renderSlate()`): one pass over every available player for the selected week, then four lists: top rushing yards (QBs included), top receiving yards (all positions), anytime TD, QB passing yards. Game filter and top-N selector. OUT/BACKUP/bye players are excluded via `neutralOptsFor`.
- Anytime TD: P(>=1 TD) = 1 - exp(-(Rush TD + Rec TD)); fair decimal odds = 1/P. QBs are excluded (QB rushing TD is not modelled). These are projection-derived, not bookmaker prices (bet365/Sportsbet prices cannot be pulled).
- Caution: baselines for Henry/Jacobs carry ~1.0 rush TD per game, so the Poisson TD chance tops out near 69%. TD counts are high-variance and not truly Poisson, so treat the top of that list as an upper bound.
- tools/audit.js now checks Week Board lists against the engine (rush/rec yards, TD chance, pass yards) and that no OUT/bye player is listed.

## Open-items follow-up (Oct 28, 2026, later)
- Week Board anytime-TD list now shows fair decimal odds only (no percentage column), shortest first.
- Injury re-run: ESPN injuries feed re-pulled (800 rows, same as the morning pull) and 32 rosters re-pulled; merge.py shows no status changes, so tables and AVAILABILITY_LAST_VERIFIED are unchanged. Next real change point is the Thursday/Friday reports.
- McCarthy (2026 weight kept): his two games are 495 yd on 49 attempts (10.1 per attempt) against 6.7 per attempt over 243 attempts in 2025. By attempts the 2026 share is 17%; the current blend uses 21%, so 2026 is already weighted above its attempt share. Doubling to about 35% would rest on 2 games, so not applied. Revisit after 4+ starts.
- Surtain (grade 67 kept): DEN's Week 8 opponent is KC. Setting him to 72 moves KC players by 0.01 PPR or less, because his grade only feeds the questionable-defender weighting. Immaterial; no change.
- Harrison (no ROLE_2026 line): since joining HOU he has 4 targets in each of 2 games (4.0 average) against a 4.7 baseline, third behind Collins (7.0) and Hutchinson (5.7); the volume gap is 15-26%, under the 35% rule. HOU is on bye in Week 8, so nothing changes until Week 9.

## Defensive profile refresh (Oct 28, 2026, Weeks 1-7)
- Already current before this pass: pass/rush tiers, man/zone coverage, pressure (all Oct 28), DvP tables (Weeks 1-7), DEF_ROSTER and DEF_AVAILABILITY.
- Rebuilt this pass: TEAM_RUN_DEFENSE_2024 (overall = PFF team RDEF 2025 REG blended 17 : games with 2026 Reg+Post; interior = run-snap-weighted DI RDEF, same blend; re-expressed to the old table's mean/spread; new vs old table corr 0.98), TEAM_SACK_DATA (pre-Oct-7 base + 2026 Weeks 1-7 sacks and pressures summed over ED, DI, LB; Wk1-4 increment matches the Oct 7 numbers at the expected scale), TEAM_SLOT_COVERAGE (PFF Slot Coverage pages, CB and S, 2025 REG with the 30-snap minimum pooled with all 2026 defenders; the 2025-only recompute correlates 0.95 with the old table).
- PFF page notes: report selector is the "Box Score Report" button; slot coverage is defense-coverage-slot?position=CB|S (columns: COV snaps, TGT, REC, YDS, YAC, TD, INT, NFL, Y/SNP). Defense pages cap rows at 200 (pages of 100 on slot pages); the 2025 ED and DI pages have a second page. PFF team codes: ARZ, BLT, CLV, HST, LA. A defender with no run snaps has "-" for RDEF, so guard NaN before weighting.
- Defense v Position tab now has a Slot WR rank and yards-per-snap column (sortable). Slot data is display only: it is not used by the engine.

## Alignment DvP (estimate), Oct 28, 2026
- PFF has no "yards allowed by receiver alignment" for WR or TE. ALIGN_DVP_2026 is built by hand: every ESPN receiving line by a WR/TE is split into slot / wide / inline using that receiver's PFF 2026 pass-snap alignment (receiving pages position=WR and TE, columns SLOT, WIDE, INL), summed by opposing defence, divided by games played. Names matched with punctuation and suffixes stripped (aliases: Chig/Chigoziem Okonkwo, Matt/Matthew Hibner, Hollywood/Marquise Brown). RBs excluded (WR/TE share of receiving yards 77-95% by team, mean 86%). Per-team slot + wide + inline totals agree with DvP WR + TE yards (JAX 245 vs 245).
- Caveat: allocation, not measurement; assumes each receiver's alignment split is the same in every game. Shown as "(est)" columns on Defense v Position. Display only, not used in projections.
- Refresh: re-pull the two PFF receiving pages and rerun wk8/align/calc.py with the latest box.json.

## Thursday availability refresh (Oct 29, 2026)
- ESPN injuries and 32 rosters re-pulled (feed timestamp Oct 29 04:40 UTC, includes Wednesday practice reports). Offence 69 -> 85 listed, defence 72 -> 97. New offensive QUESTIONABLE: Chase, Gibbs, Bowers, Pickens, A.J. Brown, Waddle (already), Kincaid, Tate, Allgeier, Braelon Allen, Mims, M. Wilson, Diggs, Meyers, Burks and others. Newly OUT: Dameon Pierce, Jaylin Noel (HOU bye in Week 8). Terry McLaurin on IR (already OUT). Mariota and Jaylen Wright cleared.
- Transactions checked: DeForest Buckner IND -> SF (DEF_ROSTER moved), Quenton Nelson IND -> SEA (NOT applied: OL grades are team-level from Weeks 1-7, so IND/SEA blocking factors still reflect the old lines), Erick All and Tyrone Tracy on IR (Tracy already OUT in the table, All not tracked).
- AVAILABILITY_LAST_VERIFIED = Oct 29, 2026. Next: Friday report, then Sunday inactives (about 90 minutes before each kickoff).

## Added Oct 29, 2026 (user request): Jonah Coleman (DEN RB), Omar Cooper Jr. (NYJ WR), Ja'Kobi Lane (BAL WR)
- Per-game averages over the games each actually played (3 each, from PFF games and ESPN lines; each was absent for team games, so averaging over all team games would understate the role), then shrunk 50% (3 games against a 3-game prior) toward the median WR-depth baseline (4.25 tgt / 2.5 rec / 31.75 yd / 0.17 TD) or RB-depth baseline (5.5 att / 20 yd / 0.15 TD / 1.14 rec / 7.2 yd) already in the tool. Cooper's raw 19 yards per target is not carried forward.
- Also added to the PFF grade tables (and Coleman to the elusive table). ESPN lists all three Active (Oct 25-27).
- Week 8 projections: Cooper (NYJ vs LV) 4.4 tgt / 54.2 yd / 0.4 TD, 11.1 PPR; Coleman (DEN vs KC) 6.1 att / 26.0 yd, 6.4 PPR; Lane (BAL vs BUF) 4.3 tgt / 26.3 yd, 5.7 PPR. Backfield and target totals for DEN, NYJ, BAL are not re-balanced (same as earlier sweep additions).
- Other names from the Oct 29 sweep list (Goodson, Tucker, Isaiah Davis, Van Jefferson, Ekeler, Grandy, Blue, Sampson) were left out on request.

## Friday availability refresh (Oct 30, 2026)
- ESPN injuries (feed timestamp Oct 29 21:07 UTC, Thursday practice reports), 32 rosters and transactions re-pulled. Offence 85 -> 83 listed, defence 97 -> 96.
- Cleared (full participants Thursday): Chase, Amon-Ra St. Brown, Gibbs, Braelon Allen; Bowers back to Active. Newly QUESTIONABLE: Travis Kelce (ankle), TreVeyon Henderson (illness, did not practise), Ray Davis (illness, did not practise). James Conner IR return date moved to Nov 8.
- Tonight's CAR @ GB (Thu 8:15pm ET / Fri 11:15am Melbourne): only Matthew Golden (GB WR, QUESTIONABLE, shoulder) flagged on offence; Chuba Hubbard, McMillan, Coker, Love, Kraft, Watson all Active. Defence: GB Parsons OUT (ACL), Franklin OUT; CAR Jaelan Phillips OUT, Evans on IR, OL Lewis and Simpkins OUT.
- Transaction applied: Jeffery Simmons TEN -> CHI (DEF_ROSTER moved). Jonah Laulu, Bullard, Kerby Joseph and Norman-Lott returns noted, not applied.
- QUESTIONABLE players are still counted in projections, so no Week 8 projection moved (Kelce 15.9, Gibbs 23.4 PPR before and after); only the status badges changed. AVAILABILITY_LAST_VERIFIED = Oct 30, 2026. Next: Sunday inactives about 90 minutes before each kickoff. Byes Week 8: NO, NYG, SF, HOU.

## QB passing-yards fix (Oct 30, 2026)
- Problem: QB_2026_LINES stored yards per 30 attempts (game-equivalent = attempts/30) but was mixed into a baseline of yards per game. High-volume QBs were understated ~20%, low-volume overstated. Week 1-7 errors ran from -108 (Young) to +90 (Mariota); league-wide mean error only -7, so it was a pattern by volume, not a general bias.
- Fix: game-equivalent = min(1, attempts/30), so lines are yards per game; QB_2026_WEIGHT 2.5 -> 6. All 38 table rows rebuilt from ESPN box scores (old values reproduced exactly before rebuilding).
- Backtest, 144 QB starts Weeks 3-7 predicted from earlier weeks only (MAE / bias): no 2026 data 56.1 / -15.8; old 54.9 / -18.0; per-game w2.5 53.8 / -10.5; w4 53.6 / -8.6; w6 53.5 / -6.7; w10 53.9 / -4.1. Gain is real but small (single-game QB yards are noisy, typical miss ~54).
- Also tested blending 2026 attempts into QB_ATT_COMP: no MAE gain (6.8 both ways), left unchanged.
- Week 8 effect: Young 177 -> 210 pass yd (PPR 12.8 -> 14.9), Love 218 -> 249 (14.8 -> 16.7), Cousins 204 -> 228, Brissett 173 -> 203; Murray, Allen, Mariota about flat.

## RB/WR/TE review (Oct 30, 2026)
- Bias check, Week 8 projections vs Weeks 1-7 per-game actuals: no volume pattern like the QB one. Mean error RB rush yd +1.3, WR rec yd -0.7, TE rec yd +1.6; by actual-volume bucket all within about 5 yd. Players with a ROLE_2026 override and without have the same MAE (11.2 yd per game).
- Extra 2026 blending for players without an override: backtest 802 yardage games and 800+ volume games (Weeks 3-7, earlier weeks only). No gain at any weight for yards (MAE 24.7 none vs 24.8-25.4 blended), targets or carries (WR targets 2.19 vs 2.16, RB carries 3.57 vs 3.55). Left unchanged; ROLE_2026 prior_g 6 is fine.
- Matchup strength: MATCHUP_SHRINK 0.6 -> 0.3 for RB/WR/TE (QB already 0.3). 1,387 player-games; ideal strength slope 0.19 +/- 0.07 (RB 0.25, WR 0.08, TE 0.35); MAE 23.36 at 0.6 -> 23.20 at 0.3. Defence profiles include the tested weeks, so the true effect is probably lower still.
- Week 8 effect: mean absolute PPR change 0.34. Swift 14.6 -> 16.7, Kraft 8.6 -> 10.4, Jacobs 19.8 -> 18.3.
- Still open: the within-team backfield/target totals are not re-balanced (e.g. GB projected 38 carries vs ~21 actual), which inflates Jacobs' rush TD (1.01 a game).

## Backfield carry rebalance (Oct 30, 2026)
- Why: the engine projected each back from his own baseline, so crowded backfields were over-counted (GB Week 8 summed to 38 carries vs 17.7 a game real).
- How: TEAM_RB_CARRIES (ESPN carries per team game by the backs in the tool, Weeks 1-7) and rbCarryFactor(): each available back's rush attempts, yards and TD x (team average / sum of available backs' baseline carries)^0.5, clamped 0.6-1.3. Availability (OUT/BACKUP) is respected, so an injury raises the others. Receiving is not rebalanced (targets backtest: no gain, 1.92 either way).
- Backtest 289 back-games (Weeks 3-7, earlier weeks only), carry MAE at strength 0 / 0.5 / 1: 3.56 / 3.39 / 3.58 -> 0.5.
- Name fixes needed to match box scores to the roster: James Cook III, Aaron Jones Sr., Chris Rodriguez Jr., Travis Etienne Jr., Jonathon Brooks, Kenny Gainwell; WSH = WAS.
- Week 8 effect (team RB carries before -> after): GB 38.2 -> 26.4 (Jacobs 16.1 -> 11.1 att, PPR 18.3 -> 14.3; Lloyd 9.8 -> 6.8; Strong 8.2 -> 5.7), PIT 29.3 -> 23.9, NYJ 26.8 -> 23.7, DEN 22.6 -> 20.8 (Coleman 6.1 -> 5.6, Dobbins 11.2 -> 10.3, Harvey 5.3 -> 4.9), DET 20.5 -> 23.0 (Gibbs 17.7 -> 19.9), WAS 8.0 -> 10.4 (White).
- Refresh TEAM_RB_CARRIES weekly with the box scores.
