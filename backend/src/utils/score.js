const categoryBucket = {
  TECHNICAL: "technical", PROJECT: "resume", RESUME: "resume", ROLE_SPECIFIC: "resume",
  APTITUDE: "aptitude", PROBLEM_SOLVING: "aptitude", COMMUNICATION: "communication",
  INTRODUCTION: "communication", BEHAVIORAL: "behavioral", SITUATIONAL: "behavioral", FOLLOW_UP: "technical"
};

export function aggregateScores(questionAnswers, weights) {
  const groups = Object.fromEntries(Object.keys(weights).map((key) => [key, []]));
  for (const item of questionAnswers) {
    const bucket = categoryBucket[item.question.category] || "technical";
    groups[bucket].push(item.answer.evaluation);
  }
  const average = (items, selector) => items.length ? Math.round(items.reduce((total, item) => total + Number(selector(item) || 0), 0) / items.length) : 0;
  const scores = {
    technicalScore: average([...groups.technical, ...groups.resume], (x) => x.accuracy),
    aptitudeScore: average(groups.aptitude, (x) => x.overall),
    communicationScore: average(groups.communication, (x) => x.communication),
    resumeAuthenticityScore: average(groups.resume, (x) => x.resumeClaimConfidence),
    behavioralScore: average(groups.behavioral, (x) => x.overall)
  };
  const weighted = [
    [scores.technicalScore, weights.technical + weights.resume], [scores.aptitudeScore, weights.aptitude],
    [scores.communicationScore, weights.communication], [scores.behavioralScore, weights.behavioral]
  ];
  scores.overallScore = Math.round(weighted.reduce((total, [score, weight]) => total + score * weight, 0) / 100);
  return scores;
}
