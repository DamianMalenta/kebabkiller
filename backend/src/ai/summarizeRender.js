/**
 * Rule-based extraction from director_json → compact render_summary (~150 tokens).
 * Never sends full prompts to series-memory LLM.
 */

function parseDirectorJson(directorJson) {
  if (!directorJson) return {};
  if (typeof directorJson === 'string') {
    try {
      return JSON.parse(directorJson);
    } catch {
      return {};
    }
  }
  return directorJson;
}

function deriveContinuityNotes(userPrompt, parsed) {
  const text = `${userPrompt} ${parsed?.scene_summary || ''}`;
  const notes = [];
  if (/cień|shadow/i.test(text)) notes.push('motyw cienia na ścianie / tle');
  if (/piec|oven/i.test(text)) notes.push('scena w piecu ceglanym');
  if (/blat|counter/i.test(text)) notes.push('stalowy blat jako punkt akcji');
  return notes.length > 0 ? notes.join('; ') : null;
}

function deriveToneTags(userPrompt, lighting, sceneSummary) {
  const text = `${userPrompt} ${lighting || ''} ${sceneSummary || ''}`.toLowerCase();
  const tags = [];
  if (/dramat|cień|shadow|epick/i.test(text)) tags.push('dramatic');
  if (/ciepł|warm|oven|piec/i.test(text)) tags.push('warm');
  if (/komedi|gag|zabawn|przechyl/i.test(text)) tags.push('physical comedy');
  if (/spokoj|wolno|static/i.test(text)) tags.push('calm');
  return tags.slice(0, 4);
}

/**
 * @param {object} job - row from video_jobs (user_prompt, etc.)
 * @param {object|string} directorJson
 * @param {{ characterName?: string, backgroundName?: string }} names
 */
export function extractRenderSummary(job, directorJson, { characterName, backgroundName } = {}) {
  const parsed = parseDirectorJson(directorJson);
  const cinema = parsed.cinematography || {};
  const kin = parsed.kinematics || {};

  const cameraShot = cinema.camera_shot || 'medium shot';
  const cameraMotion = cinema.camera_motion || 'static';
  const lighting = cinema.lighting || '';

  const actionEn = (parsed.scene_summary || kin.primary_motion || '').trim();
  const scenePl = (job.user_prompt || '').trim();

  return {
    scene_pl: scenePl,
    action_en: actionEn,
    camera: `${cameraShot}, ${cameraMotion}`,
    lighting,
    character: characterName || null,
    background: backgroundName || null,
    subject_state: kin.subject_state || null,
    tone: deriveToneTags(scenePl, lighting, actionEn),
    continuity_notes: deriveContinuityNotes(scenePl, parsed),
  };
}

export function formatRenderSummaryForPrompt(summary) {
  if (!summary) return '';
  const parts = [
    summary.scene_pl && `Scena: ${summary.scene_pl}`,
    summary.action_en && `Akcja: ${summary.action_en}`,
    summary.camera && `Kamera: ${summary.camera}`,
    summary.lighting && `Światło: ${summary.lighting}`,
    summary.character && `Postać: ${summary.character}`,
    summary.background && `Tło: ${summary.background}`,
    summary.tone?.length && `Ton: ${summary.tone.join(', ')}`,
    summary.continuity_notes && `Ciągłość: ${summary.continuity_notes}`,
  ];
  return parts.filter(Boolean).join('\n');
}
