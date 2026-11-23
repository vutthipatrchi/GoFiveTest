import type { Cycle, ManagerId, Person, Team } from "../types";
import { operationsSpecialistTemplate } from "./goal-plan";
import { calibratedLevel, raisedOnAppeal } from "./appeals";
import { proposal, score } from "./kpi";
import { managersInCycle, personManagerId } from "./managers";
import { confirmedLevel, currentCalibration } from "./performance";

export const ratingLevels = [1, 2, 3, 4, 5] as const;
type Level = (typeof ratingLevels)[number];

export interface ManagerComparisonFilters {
  group: string;
  manager: ManagerId | "";
  rating?: Level;
  adjusted?: boolean;
}

export const emptyManagerComparisonFilters: ManagerComparisonFilters = { group: "", manager: "" };

interface ComparisonGroup {
  id: string;
  team: Team;
  title: string;
  cohort: string;
}

function groupId(person: Pick<Person, "team" | "title" | "cohort">) {
  return JSON.stringify([person.team, person.title, person.cohort]);
}

function validLevel(value: number | undefined): value is Level {
  return ratingLevels.some(level => level === value);
}

function comparisonCase(person: Person, cycle: Cycle) {
  if (!person.review || !validLevel(person.review.rating) || !["hr", "decided", "published"].includes(person.status)) return;
  const confirmed = confirmedLevel(person, cycle);
  // Appeal changes are counted separately so they do not read as calibration adjustments.
  const final = confirmed === undefined ? undefined : calibratedLevel(person, confirmed);
  const record = final === undefined ? undefined : currentCalibration(person);
  const before = final === undefined ? proposal(person, cycle.resultWeight)?.level : record?.proposed.level ?? person.decision?.proposed;
  return {
    person,
    managerId: personManagerId(person),
    managerRating: record?.manager.rating ?? person.review.rating,
    workScore: record ? record.workScore : score(person),
    before: validLevel(before) ? before : undefined,
    final,
    adjustment: final !== undefined && validLevel(before) ? final - before : undefined,
  };
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function managerComparison(people: Person[], cycle: Cycle, filters: ManagerComparisonFilters) {
  const groups = new Map<string, ComparisonGroup>();
  for (const person of people) {
    if (!cycle.teams.includes(person.team)) continue;
    const id = groupId(person);
    groups.set(id, { id, team: person.team, title: person.title, cohort: person.cohort });
  }
  const available = [...groups.values()];
  const selected = groups.get(filters.group) ?? available.find(group =>
    group.team === "Operations" && group.title === operationsSpecialistTemplate.title) ?? available[0];
  const members = selected ? people.filter(person => groupId(person) === selected.id) : [];
  const managers = managersInCycle(cycle).filter(manager => manager.team === selected?.team)
    .filter(manager => members.some(person => personManagerId(person) === manager.id));
  const cases = members.flatMap(person => {
    const result = comparisonCase(person, cycle);
    return result ? [result] : [];
  });
  const summaries = managers.map(manager => {
    const reviewed = cases.filter(entry => entry.managerId === manager.id);
    const pairs = reviewed.flatMap(entry => entry.before !== undefined && entry.final !== undefined
      ? [{ before: entry.before, final: entry.final }] : []);
    return {
      manager,
      assigned: members.filter(person => personManagerId(person) === manager.id).length,
      reviewed: reviewed.length,
      distribution: ratingLevels.map(level => ({ level, count: reviewed.filter(entry => entry.managerRating === level).length })),
      behaviorMean: mean(reviewed.map(entry => entry.managerRating)),
      paired: pairs.length,
      beforeMean: mean(pairs.map(pair => pair.before)),
      afterMean: mean(pairs.map(pair => pair.final)),
      adjusted: pairs.filter(pair => pair.before !== pair.final).length,
      raisedOnAppeal: reviewed.filter(entry => raisedOnAppeal(entry.person.appeal)).length,
    };
  });
  const shown = cases.filter(entry => (!filters.manager || filters.manager === entry.managerId) &&
    (filters.rating === undefined || filters.rating === entry.managerRating) &&
    (!filters.adjusted || (entry.adjustment !== undefined && entry.adjustment !== 0)));
  return { groups: available, selected, summaries, cases, shown };
}
