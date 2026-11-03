export interface BriefScope { temporary:boolean; conversationId:string|null }
export interface BriefMemory {
 enabled:boolean; revision:string;
 items:{id:string;title:string;summary:string;learnedAt:string;sourceMessageIds:string[];revision:string}[];
}
