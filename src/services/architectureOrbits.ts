import type * as T from 'three';

/** Keep the architecture labels in their reserved sky lanes. The galaxy and
 * individual stars retain their motion; readable cluster targets do not orbit
 * through the Omega, avatars or engine selector. */
export function architectureOrbits(host:HTMLElement,_camera:T.Camera){
 const dial=host.closest('.command-instrument__dial');
 let elements:HTMLElement[]=[];
 return {
  update(_time:number){
   if(!elements.length)elements=Array.from(dial?.querySelectorAll<HTMLElement>('.armory-constellation,.skills-constellation')??[]);
   for(const element of elements){
    if(element.style.transform!=='none')element.style.transform='none';
    if(element.style.visibility!=='visible')element.style.visibility='visible';
   }
  },
  dispose(){for(const element of elements){element.style.removeProperty('transform');element.style.removeProperty('visibility');}},
 };
}
