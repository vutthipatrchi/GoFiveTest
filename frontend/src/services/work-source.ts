import { sampleWorkSource } from "../data/work-samples";
import { goalCutoffs } from "../domain/goal-plan";
import type { GoalDefinition, WorkSource } from "../types";

/** Where employee work records and KPI results come from. Replace the mock with the real system's adapter here. */
export interface WorkSourceProvider {
  forPerson(personId: string): WorkSource | undefined;
  resultFor(personId: string, goal: GoalDefinition): number | undefined;
}

const mockLevels = [3, 4, 3, 2, 4, 3, 5, 1];

function stableHash(text: string) {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

/** The same person and KPI always get the same demo result, so every test run matches. */
function mockResult(personId: string, goal: GoalDefinition) {
  if (!sampleWorkSource(personId)) return undefined;
  const cutoffs = goalCutoffs(goal);
  const level = mockLevels[stableHash(`${personId}|${goal.name}`) % mockLevels.length];
  if (level > 1) return cutoffs[level - 2];
  const step = Math.max(1, Math.abs(cutoffs[1] - cutoffs[0]));
  return goal.direction === "lower" ? cutoffs[0] + step : Math.max(0, cutoffs[0] - step);
}

const mockWorkSource: WorkSourceProvider = { forPerson: sampleWorkSource, resultFor: mockResult };

export const workSourceFor = (personId: string) => mockWorkSource.forPerson(personId);
export const kpiResultFor = (personId: string, goal: GoalDefinition) => mockWorkSource.resultFor(personId, goal);
