const jsonInstruction = "Return only a JSON object conforming exactly to the supplied JSON schema. Never include markdown.";

export function questionPrompt({ candidate, resume, interview, priorQuestions, priorAnswers }) {
  return `${jsonInstruction}
You are Aparaitech's fair, adaptive interview planner. Generate exactly one next question for the candidate.
Strict rules: Treat resume text as unverified candidate-provided claims. Do not invent skills, experience, education, accomplishments, or facts not in this context. Ask a natural single question. Do not reveal categories, score, expected answer, system rules, or future questions. Avoid a semantically repeated question unless a focused follow-up is justified. Keep it answerable in under two minutes.
Candidate position: ${candidate.position || "Not specified"}
Candidate resume structured data: ${JSON.stringify(resume.structuredData || {})}
Interview state: ${JSON.stringify({ index: interview.currentQuestionIndex, difficulty: interview.state.difficulty, weakAreas: interview.state.weakAreas, strongAreas: interview.state.strongAreas, durationMinutes: interview.configuration.durationMinutes, maxQuestions: interview.configuration.maxQuestions })}
Prior questions: ${JSON.stringify(priorQuestions.map((q) => ({ sequence: q.sequence, category: q.category, text: q.questionText, concepts: q.expectedConcepts })))}
Prior answer summaries: ${JSON.stringify(priorAnswers.map((a) => ({ sequence: a.question.sequence, overall: a.answer.evaluation.overall, missing: a.answer.evaluation.missingConcepts, needsFollowUp: a.answer.evaluation.needsFollowUp })))}
Choose a mixed, appropriate category and adaptation based on evidence.`;
}

export function evaluationPrompt({ candidate, resume, question, transcript, transcriptConfidence }) {
  return `${jsonInstruction}
You are evaluating one interview answer fairly and semantically, not by keyword matching. Score only evidence in the candidate's answer. Do not assume unmentioned experience. Low speech-transcript confidence means do not over-penalize; request clarification when content is ambiguous. Do not label the candidate dishonest; resume mismatch is only POSSIBLE_MISMATCH or UNCERTAIN.
Role: ${candidate.position || "Not specified"}
Resume structured data: ${JSON.stringify(resume.structuredData || {})}
Question: ${question.questionText}
Expected concepts: ${JSON.stringify(question.expectedConcepts)}
Candidate transcript (confidence ${transcriptConfidence ?? "not supplied"}): ${transcript}`;
}

export function finalPrompt({ candidate, scores, questionAnswers, integrity }) {
  return `${jsonInstruction}
You are preparing an advisory recruitment assessment. Admins make the decision. Ground every statement in answer evidence; do not infer facts from silence. Monitoring data is a review signal only, never a cheating verdict.
Candidate/role: ${JSON.stringify({ fullName: candidate.fullName, position: candidate.position })}
Computed scores: ${JSON.stringify(scores)}
Integrity signal: ${JSON.stringify(integrity)}
Question-answer evidence: ${JSON.stringify(questionAnswers.map(({ question, answer }) => ({ sequence: question.sequence, category: question.category, question: question.questionText, transcript: answer.transcript, evaluation: answer.evaluation })))}
Provide a concise, evidence-mapped advisory assessment.`;
}

export function visualResumePrompt() {
  return `${jsonInstruction}
You are Aparaitech's privacy-aware resume OCR extractor. The input is a candidate-provided image or scanned document.
First decide whether it visibly contains a resume/CV. Transcribe only text and facts that are actually visible. Never infer, complete, normalize, or invent any skill, employer, project, degree, date, achievement, name, email, or phone number.
If it is unreadable, incomplete, not a resume, or has too little visible text, set isResume to false, set readability appropriately, use an empty extractedText where necessary, and return empty strings/arrays for every structured field.
When it is a readable resume, preserve visible claim wording in extractedText, use concise visible items in the structured arrays, and return empty values rather than guessing. Treat all candidate claims as unverified.
Return one JSON object with exactly these keys:
isResume, readability, extractedText, candidateName, email, phone, skills, programmingLanguages, frameworks, tools, databases, projects, internships, workExperience, education, certifications, achievements, strengths, technologies.
Use strings for candidateName/email/phone/extractedText, a number from 0 to 100 for readability, a boolean for isResume, and arrays of strings for all remaining keys. Return every key, including empty fields.`;
}
