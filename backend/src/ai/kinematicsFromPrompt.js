/**
 * Derives motion semantics from the user's Polish scene text.
 * No hardcoded scene templates — only verb/pattern cues present in the prompt.
 */

const MOTION_CUES = [
  { pattern: /\bwyskakuj\w*\b|\bwyskoc\w*\b|\bwypad\w*\b|\bskacz\w*\b/i, state: 'jumping', fragment: 'rigid vertical hop to a landing surface' },
  { pattern: /\bbiegn\w*\b|\bbieg\w*\b|\bpędz\w*\b/i, state: 'running', fragment: 'rapid forward movement across the surface' },
  { pattern: /\bpotyk\w*\b|\bupad\w*\b|\bspad\w*\b|\bprzewrac\w*\b/i, state: 'falling', fragment: 'loses balance and tips downward' },
  { pattern: /\btocz\w*\b|\bturl\w*\b/i, state: 'rolling', fragment: 'rolls across the surface as a rigid body' },
  { pattern: /\bleż\w*\b|\blez\w*\b/i, state: 'lying', fragment: 'comes to rest flat on the surface' },
  { pattern: /\bsiad\w*\b|\bsiedz\w*\b/i, state: 'sitting', fragment: 'holds a lowered seated pose' },
  { pattern: /\bstoi\b/i, state: 'standing', fragment: 'maintains upright balance' },
];

const TRANSITION_PATTERN = /\b(nagle|potem|następnie|później|pozniej|w końcu|zaraz)\b/i;

const DYNAMIC_RANK = {
  jumping: 6,
  running: 5,
  falling: 5,
  rolling: 4,
  standing: 3,
  sitting: 2,
  lying: 1,
};

const STATE_MOTION_CONFLICT = {
  sitting: /\b(jump|leap|hop|tumble|ascent|launch|vault)\b/i,
  standing: /\b(fall|drop|collapse|tumble|tip\b|topple)\b/i,
  lying: /\b(jump|run|hop|leap|ascent)\b/i,
  rolling: /\b(jump|stand|sit)\b/i,
};

export function extractMotionBeatsFromPolish(userPrompt) {
  const beats = [];

  for (const cue of MOTION_CUES) {
    const flags = cue.pattern.flags.includes('g') ? cue.pattern.flags : `${cue.pattern.flags}g`;
    const regex = new RegExp(cue.pattern.source, flags);
    let match;
    while ((match = regex.exec(userPrompt)) !== null) {
      beats.push({
        state: cue.state,
        fragment: cue.fragment,
        index: match.index,
        matched: match[0],
      });
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  }

  return beats.sort((a, b) => a.index - b.index);
}

export function resolveDominantBeat(beats, userPrompt) {
  if (!beats.length) return null;
  if (beats.length === 1) return beats[0];

  const lower = userPrompt.toLowerCase();
  let lastTransitionIndex = -1;
  const transitionRegex = /\b(nagle|potem|następnie|później|pozniej|w końcu|zaraz)\b/gi;
  let match;
  while ((match = transitionRegex.exec(lower)) !== null) {
    lastTransitionIndex = match.index;
  }

  if (lastTransitionIndex >= 0) {
    const afterTransition = beats.filter((beat) => beat.index > lastTransitionIndex);
    if (afterTransition.length > 0) {
      return afterTransition[afterTransition.length - 1];
    }
  }

  return beats.reduce((best, beat) => {
    const bestRank = DYNAMIC_RANK[best.state] ?? 0;
    const beatRank = DYNAMIC_RANK[beat.state] ?? 0;
    return beatRank > bestRank ? beat : best;
  });
}

export function inferVelocityFromPolish(userPrompt) {
  const lower = userPrompt.toLowerCase();
  if (/szybko|szybki|biegn|pędz/i.test(lower)) return 'rapid';
  if (/wolno|powoli/i.test(lower)) return 'slow';
  return 'static';
}

export function isKinematicsContradictory(kinematics) {
  if (!kinematics?.subject_state || !kinematics?.primary_motion) return false;
  const conflictPattern = STATE_MOTION_CONFLICT[kinematics.subject_state];
  return conflictPattern ? conflictPattern.test(kinematics.primary_motion) : false;
}

export function buildBeatSequenceMotion(beats) {
  if (!beats.length) return null;
  const uniqueFragments = [];
  for (const beat of beats) {
    if (!uniqueFragments.includes(beat.fragment)) {
      uniqueFragments.push(beat.fragment);
    }
  }
  return uniqueFragments.join(', then ');
}

/**
 * Align LLM kinematics with motion cues read from the user's Polish prompt.
 * Never injects actions that are not implied by the prompt text.
 */
export function reconcileKinematicsWithPrompt(userPrompt, kinematics) {
  const beats = extractMotionBeatsFromPolish(userPrompt);
  const dominant = resolveDominantBeat(beats, userPrompt);
  const reconciled = { ...kinematics };
  let changed = false;
  const wasContradictory = isKinematicsContradictory(reconciled);

  if (dominant && reconciled.subject_state !== dominant.state) {
    const shouldOverride =
      wasContradictory ||
      (beats.length > 1 && TRANSITION_PATTERN.test(userPrompt));

    if (shouldOverride) {
      reconciled.subject_state = dominant.state;
      changed = true;
    }
  }

  if (beats.length > 1) {
    const beatMotion = buildBeatSequenceMotion(beats);
    if (beatMotion && (wasContradictory || !reconciled.primary_motion?.trim())) {
      reconciled.primary_motion = beatMotion;
      changed = true;
    }
  } else if (dominant && wasContradictory) {
    reconciled.primary_motion = dominant.fragment;
    changed = true;
  }

  const hasExplicitVelocityCue =
    /\b(szybko|szybki)\b/i.test(userPrompt)
    || /\b(biegn|pędz)\w*/i.test(userPrompt)
    || /\b(wolno|powoli)\b(?!\s+się)/i.test(userPrompt);
  const inferredVelocity = inferVelocityFromPolish(userPrompt);
  if (hasExplicitVelocityCue && inferredVelocity !== reconciled.velocity) {
    reconciled.velocity = inferredVelocity;
    changed = true;
  }

  return { kinematics: reconciled, beats, changed };
}

export function inferKinematicsFromPolish(userPrompt) {
  const beats = extractMotionBeatsFromPolish(userPrompt);
  const dominant = resolveDominantBeat(beats, userPrompt);

  if (!dominant) {
    return {
      subject_state: 'standing',
      primary_motion: 'performs the described physical action',
      velocity: inferVelocityFromPolish(userPrompt),
    };
  }

  return {
    subject_state: dominant.state,
    primary_motion: buildBeatSequenceMotion(beats) || dominant.fragment,
    velocity: inferVelocityFromPolish(userPrompt),
  };
}

export function deriveStoryboardFromBeats(beats, kinematics) {
  if (beats.length >= 2) {
    return {
      start: beats[0].fragment,
      mid: beats.slice(1, -1).map((beat) => beat.fragment).join(', then ') || beats[1].fragment,
      end: beats[beats.length - 1].fragment,
    };
  }

  const { subject_state, primary_motion } = kinematics;
  return {
    start: `Starting state: ${subject_state}.`,
    mid: primary_motion.trim(),
    end: 'Motion completes; subject holds final pose.',
  };
}
