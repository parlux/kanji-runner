# Tasks: Katakana loanwords (v1.6)

Spec: `docs/specs/SPEC-kana-words.md` (2026-11-13). Intent: `docs/intent/kana-words.md`. Idea: `docs/ideas/kana-words.md`. Queued: starts when the owner says so (independent of the 3D and stories rounds).
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Data first.** K1 lands the curated list and the pure word rules, with no change to runs.
- **Word-free runs unchanged.** The golden run is the guard: until katakana is learned, nothing changes.
- **Kanji keep priority.** One new word per run at most; words never count toward level unlocks.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Golden run changes | High | Words appended after kanji and only when eligible; golden fixture must pass unchanged (K2). |
| Long words overflow gate labels | Med | 6-character cap in data; label scaling; browser checks in 2D and 3D (K3). |
| Distractor is also correct | Med | No shared glosses in data; property test (K1, K2). |
| Words feel too rare / too common | Low | `WORDS_PER_LEVEL`, `MAX_NEW_WORDS_PER_RUN`; owner judges at Checkpoint J. |

## Phase 12: Loanwords

### Task K1: Loanword list and word rules (pure)
**Description:**
- `src/data/loanwords.json`: 150–250 common katakana loanwords, easy and everyday first, with hand-written glosses, per the spec's data rules.
- `src/core/words.ts`: load with level assignment (`WORDS_PER_LEVEL = 5` in `tuning.ts`), kana needed by a word (ー dropped, small → full size), eligibility (level + every kana at `box ≥ LEARNED_BOX`).
- `types.ts`: `WordItem`; `GateType` gets `"word"`.

**Acceptance criteria:**
- [x] Data validation test passes over the real list (characters, length, unique words, no shared glosses, ≥ 150).
- [x] Small-kana mapping, level assignment and eligibility tested.
- [x] No run changes (golden run and all existing tests pass unchanged).

**Verification:** `npm test -- words`
**Dependencies:** none
**Files:** `src/data/loanwords.json`, `src/core/{words,types,tuning}.ts`, `tests/core/words.test.ts`
**Scope:** M (most of it is curating the list)

### Task K2: Words in pool, runs, distractors and placement
**Description:**
- `pool.ts`: `Entry` word variant; eligible words after the kanji in `unlockedPool` (Built-in only; WaniKani pool passes no words).
- `run.ts`: word rows; at most 1 new word inside the 4-new cap.
- `distractors.ts`: `wordRow` per the spec.
- `progression.ts`: `place()` marks words of placed levels; `levelKeys` unchanged.

**Acceptance criteria:**
- [x] No word before its level or with an unlearned kana; ≤ 1 new word per run (property test over seeds).
- [x] Word distractors never correct (property test over all words).
- [x] Placement covers words; level unlock ignores them (tested).
- [x] Golden run unchanged; balance simulation within thresholds.

**Verification:** `npm test`
**Dependencies:** K1
**Files:** `src/core/{pool,run,distractors,progression}.ts`, `tests/core/{pool,run,distractors,progression}.test.ts`
**Scope:** M

### Task K3: Word gates, summary and study card
**Description:**
- Gate label: the word as prompt, scaled to fit 6 characters, in 2D and `?3d`.
- Summary lists missed words with their meaning.
- `study.ts` (core and game): `kind: "word"` card with glosses and a kana breakdown with romaji per character.

**Acceptance criteria:**
- [ ] Study card model tested (breakdown with small kana and ー).
- [ ] Browser checks at 390×844 and 1280×800, 2D and `?3d`, with a progress fixture where words are eligible: a 6-character word gate readable; summary and study card for a missed word. Screenshots in the scratchpad.
- [ ] Deploy green.

**Verification:** `npm test`; browser checks; deploy green.
**Dependencies:** K2
**Files:** `src/core/study.ts`, `src/game/{render,study,scenes}.ts`, `src/game/three/*`, `tests/core/study.test.ts`
**Scope:** M

### Checkpoint J: v1.6 (owner, on the phone)
- [ ] With katakana learned, kanji runs now and then ask a loanword; none uses katakana you haven't learned.
- [ ] Runs still feel mostly about kanji (or note: more / fewer words).
- [ ] Word gates are readable while steering, in 3D.
- [ ] Missed words show a useful study card.
