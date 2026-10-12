import type { LibraryEntry } from "./libraryModel";

/** Decorative topic cues, never a claim about the source's conclusions. */
export function researchMotif(entry: Pick<LibraryEntry,"title"|"userTags"|"sourceType">) {
 for (const subject of [entry.title.toLowerCase(),entry.userTags.join(" ").toLowerCase()]) {
 if (/graph|knowledge network|ontology/.test(subject)) return "graph";
 if (/loop|feedback|iterat/.test(subject)) return "loop";
 if (/agent|orchestrat|multi.agent/.test(subject)) return "agents";
 if (/llm|language model|prompt|gpt/.test(subject)) return "language";
 if (/workflow|procedure|playbook|guide/.test(subject)) return "workflow";
 if (/research|evidence|paper|verif/.test(subject)) return "research";
 }
 return entry.sourceType === "transcript" || entry.sourceType === "talk" ? "signal" : "pages";
}
export function ResearchIllustration({entry}: {entry: LibraryEntry}) {
 const motif=researchMotif(entry);
 return <svg className="research-illustration" data-motif={motif} viewBox="0 0 160 140" fill="none" aria-hidden="true">
 {motif==="graph" ? <><path d="M23 82 55 28 103 42 132 92 76 119 23 82 103 42 76 119 55 28M23 82 132 92"/>{[[23,82],[55,28],[103,42],[132,92],[76,119]].map(([cx,cy])=><circle key={cx} cx={cx} cy={cy} r="6"/>)}</> :
 motif==="agents" ? <><path d="M80 48V28M65 69 34 85M95 69l31 16M48 98h65"/><rect x="59" y="47" width="42" height="34" rx="10"/><circle cx="72" cy="61" r="2"/><circle cx="88" cy="61" r="2"/><path d="M72 71h16"/><circle cx="80" cy="23" r="5"/><rect x="12" y="82" width="36" height="28" rx="8"/><rect x="113" y="82" width="36" height="28" rx="8"/><path d="M23 94h14m87 0h14"/><path strokeDasharray="3 6" d="M30 72C24 20 136 20 130 72"/></> :
 motif==="loop" ? <><path d="M44 29a49 49 0 0 1 75 17m0 0-13-2m13 2-1-13M130 66a49 49 0 0 1-46 53m0 0 8-11m-8 11 11 6M61 117A49 49 0 0 1 29 51m0 0 5 13m-5-13-12 5"/><circle cx="80" cy="70" r="19"/><path d="m74 61 15 9-15 9Z"/></> :
 motif==="language" ? <><rect x="20" y="26" width="105" height="68" rx="13"/><path d="m44 94-9 20 32-20M40 47h63M40 59h47M40 71h55"/><path d="M137 49v48a13 13 0 0 1-13 13H85"/></> :
 motif==="workflow" ? <><rect x="17" y="20" width="46" height="26" rx="5"/><rect x="93" y="57" width="46" height="26" rx="5"/><rect x="17" y="95" width="46" height="26" rx="5"/><path d="M63 33h16v37h14M93 70H79v38H63M104 70l7 6 14-13M29 33h20M29 108h20"/></> :
 motif==="research" ? <><rect x="28" y="17" width="71" height="103" rx="5"/><path d="M42 35h40M42 47h33M42 60h21M42 102h26"/><circle cx="99" cy="78" r="26"/><path d="m118 97 23 24m-54-43 9 9 17-18"/></> :
 motif==="signal" ? <><path d="M18 70h11l7-22 12 49 13-71 14 91 14-77 13 52 12-36 10 14h16"/><path d="M20 29h25m71 0h24M20 114h25m71 0h24"/></> :
 <><rect x="37" y="19" width="78" height="100" rx="5"/><path d="M27 35v89a5 5 0 0 0 5 5h65M53 41h46M53 56h46M53 71h36M53 96h23"/><path d="m87 19 28 28H87Z"/></>}
 </svg>;
}
