import type {ConversationMessage} from '../types';

export function briefingFailure(error:unknown):string {
 const code=String(error);
 const reason=/briefing_no_(verified|current)_sources/.test(code)
  ? 'Olympus could not review enough current evidence to prepare a new brief.'
  : 'The new brief could not finish.';
 return `${reason} Any brief shown below is the last completed version.`;
}

export type BriefingOutcome = {outcome:'completed';message:ConversationMessage}|{outcome:'empty'|'shadow';message:null};
/** Native completion is distinct from an empty review and an unpublished comparison. */
export function briefingOutcome(value:unknown):BriefingOutcome {
 if(!value||typeof value!=='object')throw Error('briefing_result_invalid');
 const result=value as Record<string,unknown>;
 if((result.outcome==='empty'||result.outcome==='shadow')&&result.message===null)return result as BriefingOutcome;
 const message=result.message as Partial<ConversationMessage>|null;
 if(result.outcome==='completed'&&message&&message.role==='assistant'&&typeof message.id==='string'&&message.id.length>0&&typeof message.content==='string'&&message.content.trim()&&typeof message.timestamp==='string')return result as BriefingOutcome;
 throw Error('briefing_result_invalid');
}
