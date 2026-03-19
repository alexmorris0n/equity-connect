# Experiment Results Log

## Format

Each experiment entry should follow this structure:

```
### Experiment {number} - {date}
**Hypothesis:** {what we're testing and why}
**Variable:** {subject line / opening hook / length / CTA / etc.}
**Archetype:** {which campaign archetype}
**Baseline Campaign:** {Instantly campaign name/ID}
**Challenger Campaign:** {Instantly campaign name/ID}
**Baseline Sends:** {count}  |  **Replies:** {count}  |  **Rate:** {%}
**Challenger Sends:** {count}  |  **Replies:** {count}  |  **Rate:** {%}
**Winner:** {baseline / challenger / inconclusive}
**Learning:** {what we learned}
**Action:** {challenger becomes baseline / discard / keep running}
```

---

## Experiments

### Experiment 1 - 2026-03-18
**Hypothesis:** At 0% reply rate, the entire email approach needs radical change. Seniors delete marketing emails on sight. A curiosity-first approach — first-name-only subject line, no product mention, calculator link front and center — will break through because it doesn't look like a marketing email.
**Variable:** Full email 1 overhaul (subject line + body copy + approach)
**Archetype:** aging_in_place
**Baseline Campaign:** V2 - Aging in Place (25+ years) (`294660d0-9567-4aee-8966-8d7291dd5fd1`)
**Challenger Campaign:** EC-Optimizer-C1-curiosity-hook (`80cbde79-3bc8-4af9-81a4-9510c73713c6`)
**Status:** ACTIVE — leads splitting 50/50, daily-lead-puller deployed with challenger support

**Challenger Copy (Email 1):**
- Subject: `{{firstName}}`
- Body: ~40 words, leads with calculator link, no product mention, curiosity-driven
- Key changes vs baseline: first-name-only subject (vs long descriptive), calculator in email 1 (vs email 3), zero reverse mortgage mention, under 50 words (vs ~100+)

**Baseline Sends:** 283  |  **Replies:** 2 (spam bots)  |  **Rate:** 0%
**Challenger Sends:** 0 (just deployed)  |  **Replies:** 0  |  **Rate:** n/a
**Winner:** pending
**Learning:** pending
**Action:** pending — harvest after ~150 sends per variant (~3 days at 50/day)

---

### Experiment 1b - 2026-03-18
**Hypothesis:** Same curiosity-first approach applied across ALL active archetypes simultaneously. At 0% reply rate across the board, test whether the approach works universally or is archetype-dependent.
**Variable:** Full email 1 overhaul (subject line + body copy + approach) — same challenger copy for all archetypes
**Archetypes:** delay_ss, equity_lifeline, help_family

| Archetype | Baseline Campaign | Challenger Campaign |
|-----------|------------------|-------------------|
| delay_ss | V2 - Delay Social Security (`dc54a59e`) | EC-Optimizer-C1-delay-ss-curiosity (`f2af796a`) |
| equity_lifeline | V2 - Equity Lifeline (`bcdacad5`) | EC-Optimizer-C1-equity-lifeline-curiosity (`b8734909`) |
| help_family | V2 - Help Family (`b5c7366c`) | EC-Optimizer-C1-help-family-curiosity (`070bdaeb`) |

**Challenger Copy (Email 1 — same across all):**
- Subject: `{{firstName}}`
- Body: ~40 words, leads with calculator link, no product mention, curiosity-driven

**Status:** ACTIVE — all 4 challengers live, daily-lead-puller splitting 50/50 per archetype
**Winner:** pending per archetype
**Learning:** pending
**Action:** pending — harvest after ~150 sends per variant per archetype
