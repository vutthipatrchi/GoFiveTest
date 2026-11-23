import type { Cycle, ManagerId, Person, Team } from "../types";

export const mockPrimaryReviewers: Record<Team, string> = {
  Operations: "ธนวัฒน์ ศรีสกุล",
  People: "กมลวรรณ ตั้งกิจ",
  Finance: "วรเชษฐ์ พงศ์ไพศาล",
};

export const mockSecondaryReviewers: Record<Team, string> = {
  Operations: "สุภาวดี แก้วใส",
  People: "จิรภัทร พูนผล",
  Finance: "อรทัย วิริยะ",
};

export interface Manager {
  id: ManagerId;
  team: Team;
  name: string;
  title: `${Team} Manager`;
}

export function managersForTeam(cycle: Cycle, team: Team): [Manager, Manager] {
  const savedName = cycle.reviewers[team]?.trim();
  const primaryName = !savedName || savedName === `ผู้จัดการ ${team}` || savedName === `Manager ${team}`
    ? mockPrimaryReviewers[team] : savedName;
  const title = `${team} Manager` as const;
  return [
    { id: team, team, name: primaryName, title },
    { id: `${team}-2`, team, name: cycle.secondaryReviewers?.[team]?.trim() || mockSecondaryReviewers[team], title },
  ];
}

export const managersInCycle = (cycle: Cycle) => cycle.teams.flatMap(team => managersForTeam(cycle, team));

export function personManagerId(person: Pick<Person, "team" | "managerId">): ManagerId {
  return person.managerId === `${person.team}-2` ? person.managerId : person.team;
}

export function managerForPerson(cycle: Cycle, person: Pick<Person, "team" | "managerId">) {
  const managers = managersForTeam(cycle, person.team);
  return managers[personManagerId(person) === person.team ? 0 : 1];
}

export function directReports(people: Person[], managerId: ManagerId) {
  return people.filter(person => personManagerId(person) === managerId);
}
