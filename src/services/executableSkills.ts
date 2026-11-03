import { runReview } from "./projectReviews";

export interface LocalSkill<I,O> {
  id:string;
  name:string;
  purpose:string;
  input:string;
  authority:string;
  command:string;
  run:(input:I, trigger:"manual"|"daily")=>Promise<O>;
}
export const projectChangeReview:LocalSkill<string,Awaited<ReturnType<typeof runReview>>> = {
  id:"project-change-review", name:"Project Change Review",
  purpose:"Find the change in a project's committed revision and retain its source.",
  input:"Visible registered Git project or a folder beneath the configured projects root",
  authority:"Read local Git and save the observation in Olympus",
  command:"/project-review",
  run:(project,trigger)=>runReview(project,trigger==="daily"),
};
export const executableSkills=[projectChangeReview] as const;

export function matchSkillRequest(text:string) {
  for(const skill of executableSkills) {
    const prefix=[skill.command+" ",skill.name+" for ",skill.name+": "].find(value=>text.toLowerCase().startsWith(value.toLowerCase()));
    if(prefix && text.slice(prefix.length).trim())return {skill,input:text.slice(prefix.length).trim()};
  }
  return null;
}
