-- Kebabkiller Studio — SQLite schema

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  reference_path TEXT,
  negative_prompt TEXT NOT NULL DEFAULT 'human arms, hands, fingers, humanoid torso, melting, morphing',
  identity_block_en TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  environment_block_en TEXT,
  reference_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'global',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  style_bible_json TEXT,
  series_memory TEXT,
  series_memory_updated_at TEXT,
  default_character_id TEXT,
  default_background_id TEXT,
  desk_status TEXT NOT NULL DEFAULT 'draft',
  wizard_step TEXT NOT NULL DEFAULT 'series_start',
  canon_json TEXT,
  generator_tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (default_character_id) REFERENCES characters(id),
  FOREIGN KEY (default_background_id) REFERENCES backgrounds(id)
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  synopsis_pl TEXT NOT NULL DEFAULT '',
  director_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, episode_number)
);

CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  user_prompt TEXT NOT NULL,
  character_id TEXT,
  background_id TEXT,
  project_id TEXT,
  episode_id TEXT,
  scene_index INTEGER,
  is_canon INTEGER NOT NULL DEFAULT 0,
  canon_acceptance_in_progress INTEGER NOT NULL DEFAULT 0,
  canon_acceptance_lock_at TEXT,
  director_json TEXT,
  render_strategy TEXT NOT NULL DEFAULT 'native_i2v',
  output_path TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  status_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (background_id) REFERENCES backgrounds(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE TABLE IF NOT EXISTS render_summaries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  episode_id TEXT,
  scene_index INTEGER,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS series_memory_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  trigger_job_id TEXT,
  compaction_source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (trigger_job_id) REFERENCES video_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_project ON video_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_episode ON video_jobs(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_canon ON video_jobs(is_canon);
CREATE INDEX IF NOT EXISTS idx_render_summaries_project ON render_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(active);

-- F1: unified catalog + episode planning

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('character', 'location', 'prop', 'detail')),
  name TEXT NOT NULL,
  ref_id TEXT,
  description_pl TEXT NOT NULL DEFAULT '',
  canon_en TEXT,
  composite_default_json TEXT,
  legacy_character_id TEXT,
  legacy_background_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_name_type ON assets(name, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_ref_id ON assets(ref_id);

CREATE TABLE IF NOT EXISTS asset_images (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  path TEXT NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  ai_metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_images_asset ON asset_images(asset_id);

CREATE TABLE IF NOT EXISTS episode_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  logline TEXT NOT NULL DEFAULT '',
  preferences TEXT NOT NULL DEFAULT '',
  target_duration_sec INTEGER NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'szkic',
  catalog_selection_json TEXT,
  project_id TEXT,
  wizard_step TEXT NOT NULL DEFAULT 'episode_start',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_episode_plans_status ON episode_plans(status);

CREATE TABLE IF NOT EXISTS plan_scenes (
  id TEXT PRIMARY KEY,
  episode_plan_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description_pl TEXT NOT NULL DEFAULT '',
  duration_sec REAL NOT NULL DEFAULT 4,
  asset_id TEXT,
  asset_image_id TEXT,
  location_asset_id TEXT,
  ai_overrides_json TEXT,
  storyboard_mock_json TEXT,
  start_frame_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (asset_image_id) REFERENCES asset_images(id),
  FOREIGN KEY (location_asset_id) REFERENCES assets(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_scenes_episode ON plan_scenes(episode_plan_id);

CREATE TABLE IF NOT EXISTS plan_deliverables (
  id TEXT PRIMARY KEY,
  episode_plan_id TEXT NOT NULL,
  plan_scene_id TEXT,
  description TEXT NOT NULL,
  resolved_asset_image_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_scene_id) REFERENCES plan_scenes(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_asset_image_id) REFERENCES asset_images(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_deliverables_episode ON plan_deliverables(episode_plan_id);

-- F2: episode production (Reżyser produkcji)

CREATE TABLE IF NOT EXISTS production_runs (
  id TEXT PRIMARY KEY,
  episode_plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  export_dir TEXT,
  manifest_path TEXT,
  visual_profile_json TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  clips_total INTEGER NOT NULL DEFAULT 0,
  clips_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_runs_episode ON production_runs(episode_plan_id);

CREATE TABLE IF NOT EXISTS production_clips (
  id TEXT PRIMARY KEY,
  production_run_id TEXT NOT NULL,
  plan_scene_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  clip_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  user_prompt TEXT,
  director_json TEXT,
  output_path TEXT,
  frames_json TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_scene_id) REFERENCES plan_scenes(id)
);

CREATE INDEX IF NOT EXISTS idx_production_clips_run ON production_clips(production_run_id);

-- Director's Desk (V2)

CREATE TABLE IF NOT EXISTS director_chat_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  episode_plan_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  intent TEXT,
  widgets_json TEXT,
  pending_action_json TEXT,
  is_committed INTEGER NOT NULL DEFAULT 1,
  undo_of_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_director_chat_project ON director_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_director_chat_episode ON director_chat_messages(episode_plan_id);

CREATE TABLE IF NOT EXISTS director_side_threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  episode_plan_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_director_side_threads_project ON director_side_threads(project_id);

CREATE TABLE IF NOT EXISTS director_side_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES director_side_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_director_side_messages_thread ON director_side_messages(thread_id);
