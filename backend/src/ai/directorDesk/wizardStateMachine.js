/** Code-enforced wizard steps — AI cannot skip ahead without server transition. */

export const SERIES_STEPS = {
  START: 'series_start',
  STYLE: 'series_style',
  CANON_ASSETS: 'series_canon_assets',
  CONFIRM: 'series_confirm',
  COMPLETE: 'series_complete',
};

export const EPISODE_STEPS = {
  START: 'episode_start',
  LOGLINE: 'episode_logline',
  STORYBOARD: 'episode_storyboard',
  ASSETS: 'episode_assets',
  REVIEW: 'episode_review',
  COMPLETE: 'episode_complete',
};

export const FREE_STEP = 'free_mode';

const SERIES_ORDER = [
  SERIES_STEPS.START,
  SERIES_STEPS.STYLE,
  SERIES_STEPS.CANON_ASSETS,
  SERIES_STEPS.CONFIRM,
  SERIES_STEPS.COMPLETE,
];

const EPISODE_ORDER = [
  EPISODE_STEPS.START,
  EPISODE_STEPS.LOGLINE,
  EPISODE_STEPS.STORYBOARD,
  EPISODE_STEPS.ASSETS,
  EPISODE_STEPS.REVIEW,
  EPISODE_STEPS.COMPLETE,
];

export function isSeriesWizardComplete(step) {
  return step === SERIES_STEPS.COMPLETE || step === FREE_STEP;
}

export function isEpisodeWizardComplete(step) {
  return step === EPISODE_STEPS.COMPLETE || step === FREE_STEP;
}

export function resolveWizardMode({ projectStep, episodeStep, episodePlanId }) {
  if (episodePlanId && episodeStep && !isEpisodeWizardComplete(episodeStep)) {
    return 'episode';
  }
  if (!isSeriesWizardComplete(projectStep)) {
    return 'series';
  }
  return 'free';
}

export function getStepPrompt(mode, step) {
  const prompts = {
    series: {
      [SERIES_STEPS.START]: 'Witaj w Kreatorze Serialu. Jak ma nazywać się seria i jaki ma być klimat?',
      [SERIES_STEPS.STYLE]: 'Opisz styl wizualny (realizm, kreskówka, kolory). Zapiszę to w Kanonie.',
      [SERIES_STEPS.CANON_ASSETS]: 'Wrzuć referencje głównych bohaterów i lokacji do Globalnej Szafy.',
      [SERIES_STEPS.CONFIRM]: 'Przejrzyj Kanon w lewym panelu. Zatwierdź, gdy gotowe.',
      [SERIES_STEPS.COMPLETE]: 'Kanon serialu gotowy. Możesz tworzyć odcinki.',
    },
    episode: {
      [EPISODE_STEPS.START]: 'Nowy odcinek — co się dzieje w tej historii?',
      [EPISODE_STEPS.LOGLINE]: 'Ustal logline i kotwice bohaterów z Kanonu.',
      [EPISODE_STEPS.STORYBOARD]: 'Rozbijam historię na karty scen. Możesz je edytować.',
      [EPISODE_STEPS.ASSETS]: 'Uzupełniamy brakujące tła i rekwizyty (upload lub generacja za zgodą).',
      [EPISODE_STEPS.REVIEW]: 'Storyboard gotowy — zatwierdź przed produkcją GPU.',
      [EPISODE_STEPS.COMPLETE]: 'Plan odcinka zaakceptowany. Możesz produkować wideo.',
    },
    free: {
      [FREE_STEP]: 'Tryb reżyserii — wydawaj polecenia fabularne.',
    },
  };
  return prompts[mode]?.[step] || 'Kontynuuj pracę nad projektem.';
}

export function getAllowedToolNames(mode, step) {
  const base = ['getProjectBrain', 'listScenes'];

  const seriesTools = {
    [SERIES_STEPS.START]: [...base, 'setProjectName', 'advanceWizard'],
    [SERIES_STEPS.STYLE]: [...base, 'updateCanonStyle', 'addGeneratorTag', 'advanceWizard'],
    [SERIES_STEPS.CANON_ASSETS]: [...base, 'linkCanonAsset', 'setAssetMetadata', 'advanceWizard'],
    [SERIES_STEPS.CONFIRM]: [...base, 'confirmCanon', 'advanceWizard'],
    [SERIES_STEPS.COMPLETE]: [...base, 'startEpisodeWizard'],
  };

  const episodeTools = {
    [EPISODE_STEPS.START]: [...base, 'createEpisodePlan', 'advanceWizard'],
    [EPISODE_STEPS.LOGLINE]: [...base, 'updateEpisodeLogline', 'advanceWizard'],
    [EPISODE_STEPS.STORYBOARD]: [...base, 'upsertScene', 'removeScene', 'buildStoryboardMock', 'advanceWizard'],
    [EPISODE_STEPS.ASSETS]: [...base, 'requestAssetUpload', 'attachSceneAsset', 'buildStoryboardMock', 'advanceWizard'],
    [EPISODE_STEPS.REVIEW]: [...base, 'buildStoryboardMock', 'previewWorkflow', 'acceptEpisodePlan', 'advanceWizard'],
    [EPISODE_STEPS.COMPLETE]: [...base, 'updateSceneOverrides', 'previewWorkflow', 'produceEpisode'],
  };

  const freeTools = [
    ...base,
    'startEpisodeWizard',
    'createEpisodePlan',
    'upsertScene',
    'removeScene',
    'updateSceneOverrides',
    'addGeneratorTag',
    'removeGeneratorTag',
    'buildStoryboardMock',
    'previewWorkflow',
    'produceEpisode',
    'proposeProjectChange',
  ];

  if (mode === 'series') return seriesTools[step] || base;
  if (mode === 'episode') return episodeTools[step] || base;
  return freeTools;
}

export function canAdvance(mode, step, context = {}) {
  if (mode === 'series') {
    if (step === SERIES_STEPS.START) return Boolean(context.projectName?.trim());
    if (step === SERIES_STEPS.STYLE) return Boolean(context.canonStyle?.trim());
    if (step === SERIES_STEPS.CANON_ASSETS) return (context.canonAssetCount ?? 0) >= 1;
    if (step === SERIES_STEPS.CONFIRM) return context.canonConfirmed === true;
    return false;
  }

  if (mode === 'episode') {
    if (step === EPISODE_STEPS.START) return Boolean(context.episodePlanId);
    if (step === EPISODE_STEPS.LOGLINE) return Boolean(context.logline?.trim());
    if (step === EPISODE_STEPS.STORYBOARD) return (context.sceneCount ?? 0) >= 1;
    if (step === EPISODE_STEPS.ASSETS) return context.assetsReady === true;
    if (step === EPISODE_STEPS.REVIEW) return context.storyboardApproved === true;
    return false;
  }

  return false;
}

export function nextStep(mode, step) {
  if (mode === 'series') {
    const idx = SERIES_ORDER.indexOf(step);
    if (idx === -1 || idx >= SERIES_ORDER.length - 1) return SERIES_STEPS.COMPLETE;
    return SERIES_ORDER[idx + 1];
  }
  if (mode === 'episode') {
    const idx = EPISODE_ORDER.indexOf(step);
    if (idx === -1 || idx >= EPISODE_ORDER.length - 1) return EPISODE_STEPS.COMPLETE;
    return EPISODE_ORDER[idx + 1];
  }
  return FREE_STEP;
}

export function advanceWizardStep({ mode, currentStep, context }) {
  if (!canAdvance(mode, currentStep, context)) {
    return {
      ok: false,
      step: currentStep,
      reason: 'Warunki przejścia nie są spełnione.',
    };
  }
  const step = nextStep(mode, currentStep);
  return { ok: true, step, reason: null };
}
