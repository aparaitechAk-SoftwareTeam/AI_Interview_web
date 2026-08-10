import { InterviewState } from "@aparaitech/shared";

export const initialInterviewState = { phase: InterviewState.IDLE, transcript: "", error: null, warning: null };
export function interviewReducer(state, action) {
  switch (action.type) {
    case "PHASE": return { ...state, phase: action.phase, error: action.error || null };
    case "TRANSCRIPT": return { ...state, transcript: action.value };
    case "WARNING": return { ...state, warning: action.message, phase: InterviewState.WARNING };
    case "CLEAR_WARNING": return { ...state, warning: null, phase: action.phase || InterviewState.WAITING_FOR_ANSWER };
    default: return state;
  }
}
