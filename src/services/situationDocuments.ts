import {invoke,isTauri} from '@tauri-apps/api/core';
export interface DocumentAvailability {id:string;available:boolean;openable:boolean}
export const situationDocuments={
 status:(situationId:string)=>isTauri()?invoke<DocumentAvailability[]>('situation_document_status',{situationId}):Promise.resolve<DocumentAvailability[]>([]),
 open:(situationId:string,sourceId:string)=>invoke<void>('situation_document_open',{situationId,sourceId})
};
export type SituationDocumentsClient=typeof situationDocuments;
