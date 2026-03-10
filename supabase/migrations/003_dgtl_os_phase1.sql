-- ============================================================================
-- DGTL OS Phase 1: Kanban Project Management System
-- Workspaces, Projects, Boards, Columns, Tasks, Members, Activity Logging
-- ============================================================================

-- Workspaces
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  color text DEFAULT '#2d5a27',
  icon text DEFAULT '📋',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Boards
CREATE TABLE boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Columns (Kanban columns)
CREATE TABLE board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#e5e7eb',
  position integer DEFAULT 0,
  wip_limit integer,
  created_at timestamptz DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  column_id uuid REFERENCES board_columns(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assignee_id uuid,
  due_date date,
  labels jsonb DEFAULT '[]',
  position float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Members
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  role text DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  slack_user_id text,
  google_user_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, email)
);

-- Activity Log
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES members(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_column ON tasks(column_id);
CREATE INDEX idx_tasks_position ON tasks(board_id, column_id, position);
CREATE INDEX idx_activity_project ON activity_log(project_id, created_at DESC);
CREATE INDEX idx_boards_project ON boards(project_id);
CREATE INDEX idx_columns_board ON board_columns(board_id, position);

-- Seed default workspace
INSERT INTO workspaces (name, slug) VALUES ('DGTL', 'dgtl');

-- Seed default projects
INSERT INTO projects (workspace_id, name, slug, description, icon) VALUES
  ((SELECT id FROM workspaces WHERE slug='dgtl'), 'Analyst Platform', 'analyst', 'analyst.rizrazak.com investigative platform', '🔍'),
  ((SELECT id FROM workspaces WHERE slug='dgtl'), 'Waren Yan', 'waren-yan', 'Food delivery platform', '🍜'),
  ((SELECT id FROM workspaces WHERE slug='dgtl'), 'Kunatu', 'kunatu', 'Social platform', '💬');

-- Seed default boards per project
INSERT INTO boards (project_id, name, slug, position) VALUES
  ((SELECT id FROM projects WHERE slug='analyst'), 'Development', 'dev', 0),
  ((SELECT id FROM projects WHERE slug='analyst'), 'Content', 'content', 1),
  ((SELECT id FROM projects WHERE slug='waren-yan'), 'Development', 'dev', 0),
  ((SELECT id FROM projects WHERE slug='kunatu'), 'Development', 'dev', 0);

-- Seed default columns for each board
DO $$
DECLARE board_rec RECORD;
BEGIN
  FOR board_rec IN SELECT id FROM boards LOOP
    INSERT INTO board_columns (board_id, name, color, position) VALUES
      (board_rec.id, 'Backlog', '#e5e7eb', 0),
      (board_rec.id, 'To Do', '#dbeafe', 1),
      (board_rec.id, 'In Progress', '#fef3c7', 2),
      (board_rec.id, 'Review', '#fce7f3', 3),
      (board_rec.id, 'Done', '#d1fae5', 4);
  END LOOP;
END $$;
