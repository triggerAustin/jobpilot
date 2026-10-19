const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function skillRegex(skill, aliases = {}) {
  const names = [skill, ...(aliases[skill.toLowerCase()] ?? [])];
  return new RegExp(`(?<![\\w])(?:${names.map(escapeRegex).join("|")})(?![\\w])`, "i");
}

export function isJuniorFriendly(text) {
  return /\b(junior|entry.level|graduate|trainee|intern)\b/i.test(text);
}

export function scoreJob(job, profile, aliases = {}) {
  const text = `${job.title} ${job.description}`;
  const matched = profile.skills.filter((s) => skillRegex(s, aliases).test(text));

  const junior = isJuniorFriendly(text);
  const bonus = junior && profile.juniorBoost ? profile.juniorBoost : 0;
  const share = Math.round((matched.length / profile.skills.length) * 100);

  return {
    score: Math.min(100, share + bonus),
    matchedSkills: matched,
    missingSkills: profile.skills.filter((s) => !matched.includes(s)),
    signals: {
      remoteWorldwide: Boolean(job.remoteWorldwide),
      juniorFriendly: junior
    }
  };
}
