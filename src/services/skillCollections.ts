/** Curated reference collections are separate from backend-executable skills. */
export const superpowers = {
  id: 'superpowers', name: 'Superpowers',
  revision: '8ca22dba9a94f28898bbce59f2537ff4d87c747d',
  repository: 'https://github.com/obra/superpowers',
  reviewed: '2026-10-08',
  skills: [
    ['brainstorming', 'Design exploration', 'Clarify intent, constraints and an appropriate design before substantial changes.'],
    ['writing-plans', 'Implementation planning', 'Break an agreed design into inspectable implementation and verification steps.'],
    ['systematic-debugging', 'Systematic debugging', 'Investigate root causes before changing code; test a concrete hypothesis.'],
    ['test-driven-development', 'Test-driven development', 'Use failing tests to specify meaningful behavior, then implement and refine.'],
    ['requesting-code-review', 'Code review', 'Review a change against its requirements and identify remaining defects.'],
    ['verification-before-completion', 'Verification', 'Check fresh evidence before claiming a task is complete.'],
  ],
};
const listeners = new Set<() => void>();
export function inspectSuperpowers(){ listeners.forEach(listener => listener()); }
export function onSuperpowersInspection(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
