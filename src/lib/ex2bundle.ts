// Client-side sketch of the Ex2Bundle pipeline for focused text snippet extraction
// (Cho et al., "Example-Driven Intent Synthesis for Constrained Data Bundle Retrieval").
//
//   (2) synthesize initial bounds from example snippets   — synthesizeBounds
//   (3) relax them until the package query is feasible    — relax (Algorithm 1)
//   (4–5) execute the package query over a target doc    — solve
//   (6–8) translate slider positions to bounds; an infeasible move is re-relaxed back toward
//         the previous bounds and the slider snapped to match — sliderToBounds / moveSlider
//
// The real system hands the package query to PaQL + CPLEX. Target documents here are
// small, so `solve` enumerates every candidate snippet exactly instead.

import { topicIds, zeroVector, type Sentence, type SourceDocument, type TopicId, type TopicVector } from "@/data/documents";

export type Bound = [lb: number, ub: number];
export type Bounds = Record<TopicId, Bound>;
export type SliderPositions = Record<TopicId, number>;

const EPS = 1e-9;
const MU = 0.5; // base relaxation rate μ
const TAU = 10; // ρ is boosted every τ attempts
const ALPHA = 0.1; // slider bound-width decay α (value used in the paper's user study)
const MAX_ATTEMPTS = 500;

export function neutralSliders(): SliderPositions {
  return Object.fromEntries(topicIds.map((id) => [id, 0])) as SliderPositions;
}

/** Topic profile F(B): SUM of the sentences' topic scores. */
export function topicProfile(sentences: Sentence[]): TopicVector {
  const profile = zeroVector();
  for (const sentence of sentences) for (const id of topicIds) profile[id] += sentence.scores[id];
  return profile;
}

const PADDING = 0.1; // bounds are padded by ±10% before use (Appendix F)

/** §3.2.1 — lb_j / ub_j are the topic-wise min / max over the example snippets' profiles. */
export function synthesizeBounds(examples: Sentence[][]): Bounds {
  const profiles = examples.map(topicProfile);
  return Object.fromEntries(
    topicIds.map((id) => [id, [Math.min(...profiles.map((p) => p[id])) * (1 - PADDING), Math.max(...profiles.map((p) => p[id])) * (1 + PADDING)]]),
  ) as Bounds;
}

// Every non-empty candidate snippet of a document, with its profile, merit and word count.
type Candidates = { masks: number; profiles: Float64Array; merit: Float64Array; words: Float64Array };
const candidateCache = new Map<string, Candidates>();

function candidates(target: SourceDocument): Candidates {
  const cached = candidateCache.get(target.id);
  if (cached) return cached;
  const n = target.sentences.length;
  const K = topicIds.length;
  const masks = 1 << n;
  const profiles = new Float64Array(masks * K);
  const merit = new Float64Array(masks);
  const words = new Float64Array(masks);
  for (let mask = 1; mask < masks; mask++) {
    const bit = 31 - Math.clz32(mask & -mask);
    const rest = mask & (mask - 1);
    const sentence = target.sentences[bit];
    merit[mask] = merit[rest] + sentence.merit;
    words[mask] = words[rest] + sentence.words;
    for (let j = 0; j < K; j++) profiles[mask * K + j] = profiles[rest * K + j] + sentence.scores[topicIds[j]];
  }
  const result = { masks, profiles, merit, words };
  candidateCache.set(target.id, result);
  return result;
}

/** F_j(T^q): the largest attainable value of each topic (select every sentence). */
export function documentTotals(target: SourceDocument): TopicVector {
  return topicProfile(target.sentences);
}

/**
 * The package query
 *   SELECT PACKAGE(*) AS B FROM T^q SUCH THAT F_j(B) BETWEEN lb_j AND ub_j ∀j
 *   MAXIMIZE SUM(σ)            -- σ = term-frequency merit (C-FREQ)
 * solved exactly. When infeasible, reports the constraints violated by the candidates
 * closest to feasibility — a stand-in for the ILP solver's conflict set (e.g. CPLEX's
 * conflict refiner) that Algorithm 1 relaxes.
 */
export function solve(target: SourceDocument, bounds: Bounds): { bundle: Sentence[] | null; violated: TopicId[] } {
  const { masks, profiles, merit, words } = candidates(target);
  const K = topicIds.length;
  const totals = documentTotals(target);
  const scale = topicIds.map((id) => totals[id] / target.sentences.length || 1);
  const gaps = new Float64Array(masks);
  let best = -1;
  let closestGap = Infinity;
  for (let mask = 1; mask < masks; mask++) {
    let gap = 0;
    for (let j = 0; j < K; j++) {
      const value = profiles[mask * K + j];
      const [lb, ub] = bounds[topicIds[j]];
      if (value < lb - EPS) gap += (lb - value) / scale[j];
      else if (value > ub + EPS) gap += (value - ub) / scale[j];
    }
    gaps[mask] = gap;
    // highest merit wins; ties go to the shorter snippet
    if (gap === 0 && (best < 0 || merit[mask] > merit[best] || (merit[mask] === merit[best] && words[mask] < words[best]))) best = mask;
    if (gap > 0) closestGap = Math.min(closestGap, gap);
  }
  if (best >= 0) return { bundle: target.sentences.filter((_, i) => best & (1 << i)), violated: [] };
  const violated = new Set<TopicId>();
  for (let mask = 1; mask < masks; mask++) {
    if (gaps[mask] > closestGap * 1.5 + EPS) continue;
    topicIds.forEach((id, j) => {
      const value = profiles[mask * K + j];
      if (value < bounds[id][0] - EPS || value > bounds[id][1] + EPS) violated.add(id);
    });
  }
  return { bundle: null, violated: [...violated] };
}

/**
 * Algorithm 1 — symmetric relaxation of the violated constraints only, until the package
 * query is feasible. ρ = e^{μ·max(1, ⌊attempts/τ⌋)}, ε_j = F_j(T^q)/|T^q|; lb_j never drops
 * below 0 and ub_j is capped at F_j(T^q) (never narrowed). The result is the neutral bounds.
 */
export function relax(target: SourceDocument, initial: Bounds) {
  const totals = documentTotals(target);
  const bounds = { ...initial };
  let attempts = 0;
  for (;;) {
    const { bundle, violated } = solve(target, bounds);
    if (bundle) return { bounds, bundle, rounds: attempts };
    attempts++;
    const rho = Math.exp(MU * Math.max(1, Math.floor(attempts / TAU)));
    // If every violated bound is already fully relaxed, widen the rest as well.
    const stuck = violated.every((id) => bounds[id][0] <= EPS && bounds[id][1] >= totals[id] - EPS);
    const toRelax = stuck || attempts >= MAX_ATTEMPTS ? topicIds : violated;
    for (const id of toRelax) {
      const step = rho * (totals[id] / target.sentences.length);
      const [lb, ub] = bounds[id];
      const ceiling = Math.max(ub, totals[id]);
      bounds[id] = attempts >= MAX_ATTEMPTS || step === 0 ? [0, ceiling] : [Math.max(lb - step, 0), Math.min(ub + step, ceiling)];
    }
  }
}

/** §3.1 — map slider position γ ∈ [−100, 100] to bounds around the neutral (feasible) bounds. */
export function sliderToBounds([lb, ub]: Bound, gamma: number, mx: number): Bound {
  if (gamma === 0) return [lb, ub];
  const x = Math.abs(gamma);
  const width = Math.exp((-ALPHA * x) / 100) * (ub - lb);
  if (gamma < 0) {
    const lower = (lb * (100 - x)) / 100;
    return [lower, lower + width];
  }
  const upper = ub + ((mx - ub) * x) / 100;
  return [Math.max(0, upper - width), upper];
}

/** A target with its neutral bounds; slider positions are interpreted relative to these. */
export type PreparedTarget = { target: SourceDocument; totals: TopicVector; neutral: Bounds };

export function prepareTarget(target: SourceDocument, initial: Bounds): PreparedTarget {
  return { target, totals: documentTotals(target), neutral: relax(target, initial).bounds };
}

function boundsAt({ totals, neutral }: PreparedTarget, positions: SliderPositions): Bounds {
  return Object.fromEntries(topicIds.map((id) => [id, sliderToBounds(neutral[id], positions[id], totals[id])])) as Bounds;
}

/**
 * §3.2.3 — snap to the slider position whose bounds are closest to (and subsume) the feasible
 * bounds. Only positions on the way back from the requested position to the previous one
 * are considered, ties going to the one nearest the request. If none subsumes them, the
 * nearest feasible position on that path is used (the previous position always is).
 */
function snapPosition(feasible: Bound, path: number[], boundAt: (gamma: number) => Bound, isFeasible: (gamma: number) => boolean): number {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const gamma of path) {
    const [lb, ub] = boundAt(gamma);
    if (lb > feasible[0] + EPS || ub < feasible[1] - EPS) continue;
    const distance = Math.abs(lb - feasible[0]) + Math.abs(ub - feasible[1]);
    if (distance < bestDistance - EPS) {
      bestDistance = distance;
      best = gamma;
    }
  }
  return best ?? path.find(isFeasible) ?? path[path.length - 1];
}

/**
 * §3.2.3 — a slider move. If the requested position is infeasible, re-relax only that topic's
 * bound with Algorithm 1 steps, back toward the previously feasible bounds ⟨lb*, ub*⟩ (lb is
 * reduced until lb*, ub raised until ub*), checking feasibility after every step, then take
 * the position whose bounds are closest to the feasible ones and subsume them. Returns the
 * position this target uses; the demo leaves the visible slider where the user put it.
 */
export function moveSlider(prepared: PreparedTarget, positions: SliderPositions, topic: TopicId, requested: number): number {
  const { target, totals, neutral } = prepared;
  const bounds = boundsAt(prepared, { ...positions, [topic]: requested });
  if (solve(target, bounds).bundle) return requested;
  const [lbStar, ubStar] = sliderToBounds(neutral[topic], positions[topic], totals[topic]);
  const floor = Math.min(bounds[topic][0], Math.max(0, lbStar));
  const ceiling = Math.max(bounds[topic][1], Math.min(ubStar, totals[topic]));
  const epsilon = totals[topic] / target.sentences.length;
  for (let attempts = 1; ; attempts++) {
    const rho = Math.exp(MU * Math.max(1, Math.floor(attempts / TAU)));
    const [lb, ub] = bounds[topic];
    const done = epsilon === 0 || attempts >= MAX_ATTEMPTS;
    bounds[topic] = done ? [floor, ceiling] : [Math.max(lb - rho * epsilon, floor), Math.min(ub + rho * epsilon, ceiling)];
    // At [floor, ceiling] the bounds contain the previously feasible ones, so this terminates.
    if (done || solve(target, bounds).bundle) break;
  }
  const origin = positions[topic];
  const path = Array.from({ length: Math.abs(origin - requested) + 1 }, (_, i) => requested + i * Math.sign(origin - requested));
  return snapPosition(
    bounds[topic],
    path,
    (gamma) => sliderToBounds(neutral[topic], gamma, totals[topic]),
    (gamma) => !!solve(target, boundsAt(prepared, { ...positions, [topic]: gamma })).bundle,
  );
}

/** Re-validate positions against new neutral bounds: replay each moved slider from neutral. */
export function settle(prepared: PreparedTarget, positions: SliderPositions): SliderPositions {
  const settled = { ...positions };
  for (const id of topicIds) {
    if (settled[id] === 0) continue;
    const requested = settled[id];
    settled[id] = 0;
    settled[id] = moveSlider(prepared, settled, id, requested);
  }
  return settled;
}

export type SnippetResult = { target: SourceDocument; bundle: Sentence[]; profile: TopicVector };

/** Execute the package query for a target at the given (feasible) slider positions. */
export function snippetAt(prepared: PreparedTarget, positions: SliderPositions): SnippetResult {
  const bundle = solve(prepared.target, boundsAt(prepared, positions)).bundle ?? relax(prepared.target, prepared.neutral).bundle;
  return { target: prepared.target, bundle, profile: topicProfile(bundle) };
}
