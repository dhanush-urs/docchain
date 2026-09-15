-- File: 001_extensions.sql
-- 001_extensions.sql
-- Enable required PostgreSQL extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS vector;

-- File: 002_profiles.sql
-- 002_profiles.sql
-- User profiles table (extends Supabase auth.users)

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- File: 003_workspaces.sql
-- 003_workspaces.sql
-- Workspaces table for multi-tenant isolation

CREATE TYPE visibility AS ENUM ('public', 'private');

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id),
  settings JSONB DEFAULT '{}',
  visibility visibility DEFAULT 'private',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view workspace" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view public workspaces" ON workspaces
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "Admins can update workspace" ON workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete workspace" ON workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_visibility ON workspaces(visibility) WHERE visibility = 'public';

-- Updated at trigger
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- File: 004_workspace_members.sql
-- 004_workspace_members.sql
-- Workspace members for role-based access control

CREATE TYPE member_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'viewer',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view workspace members" ON workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage members" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- File: 005_documents.sql
-- 005_documents.sql
-- Documents table for file metadata and provenance

CREATE TYPE document_status AS ENUM ('active', 'archived', 'deleted');

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  current_version INTEGER DEFAULT 1,
  status document_status DEFAULT 'active',
  visibility visibility DEFAULT 'private',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view workspace documents" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = documents.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view public documents" ON documents
  FOR SELECT USING (
    visibility = 'public' 
    AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = documents.workspace_id AND w.visibility = 'public')
  );

CREATE POLICY "Editors can insert documents" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = documents.workspace_id AND user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors can update documents" ON documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = documents.workspace_id AND user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Indexes
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_sha256 ON documents(sha256);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_visibility ON documents(visibility) WHERE visibility = 'public';
CREATE INDEX idx_documents_status ON documents(status);

-- Updated at trigger
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- File: 006_document_versions.sql
-- 006_document_versions.sql
-- Document versions for immutable version history

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

-- Enable RLS
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view versions" ON document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN documents d ON d.id = document_versions.document_id
      WHERE wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can create versions" ON document_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN documents d ON d.id = document_versions.document_id
      WHERE wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
    )
  );

-- Indexes
CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_versions_number ON document_versions(document_id, version_number);

-- File: 007_blockchain.sql
-- 007_blockchain.sql
-- Blockchain blocks and transactions for immutable provenance ledger

CREATE TYPE blockchain_event_type AS ENUM (
  'document_uploaded', 'document_version_created', 'document_viewed',
  'document_downloaded', 'document_reviewed', 'comment_added',
  'document_verified', 'document_shared', 'guest_link_created',
  'guest_link_revoked', 'document_archived'
);

CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type blockchain_event_type NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  document_id UUID REFERENCES documents(id),
  document_version_id UUID REFERENCES document_versions(id),
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blockchain_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  block_index BIGINT NOT NULL,
  previous_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  transaction_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  nonce BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, block_index)
);

-- Enable RLS
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_blocks ENABLE ROW LEVEL SECURITY;

-- Policies (append-only - no UPDATE/DELETE for normal users)
CREATE POLICY "Members can view transactions" ON blockchain_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = blockchain_transactions.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert transactions" ON blockchain_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = blockchain_transactions.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view blocks" ON blockchain_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = blockchain_blocks.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert blocks" ON blockchain_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = blockchain_blocks.workspace_id AND user_id = auth.uid()
    )
  );

-- Public read for public workspaces
CREATE POLICY "Public can view public blocks" ON blockchain_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE d.id = (
        SELECT document_id FROM blockchain_transactions bt WHERE bt.id = blockchain_blocks.transaction_hash
      )
      AND d.visibility = 'public' 
      AND w.visibility = 'public'
    )
  );

-- Indexes
CREATE INDEX idx_blocks_workspace ON blockchain_blocks(workspace_id);
CREATE INDEX idx_blocks_hash ON blockchain_blocks(block_hash);
CREATE INDEX idx_transactions_workspace ON blockchain_transactions(workspace_id);
CREATE INDEX idx_transactions_document ON blockchain_transactions(document_id);
CREATE INDEX idx_transactions_event_type ON blockchain_transactions(event_type);

-- File: 008_timeline.sql
-- 008_timeline.sql
-- Timeline events for visual provenance history

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type blockchain_event_type NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  document_id UUID REFERENCES documents(id),
  document_version_id UUID REFERENCES document_versions(id),
  block_id UUID REFERENCES blockchain_blocks(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view timeline" ON timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = timeline_events.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert timeline" ON timeline_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = timeline_events.workspace_id AND user_id = auth.uid()
    )
  );

-- Public read for public documents
CREATE POLICY "Public can view public timeline" ON timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE d.id = timeline_events.document_id 
      AND d.visibility = 'public' 
      AND w.visibility = 'public'
    )
  );

-- Indexes
CREATE INDEX idx_timeline_workspace ON timeline_events(workspace_id);
CREATE INDEX idx_timeline_document ON timeline_events(document_id);
CREATE INDEX idx_timeline_created ON timeline_events(created_at DESC);
CREATE INDEX idx_timeline_block ON timeline_events(block_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE timeline_events;

-- File: 009_comments.sql
-- 009_comments.sql
-- Comments and reviews on documents and versions

CREATE TYPE review_status AS ENUM ('pending', 'in_review', 'approved', 'rejected');

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES document_versions(id),
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  review_status review_status DEFAULT 'pending',
  parent_id UUID REFERENCES comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view comments" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN documents d ON d.id = comments.document_id
      WHERE wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can add comments" ON comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN documents d ON d.id = comments.document_id
      WHERE wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update own comments" ON comments
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Authors can delete own comments" ON comments
  FOR DELETE USING (author_id = auth.uid());

-- Public read for public documents (excluding internal reviews)
CREATE POLICY "Public can view public comments" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE d.id = comments.document_id 
      AND d.visibility = 'public' 
      AND w.visibility = 'public'
    )
  );

-- Indexes
CREATE INDEX idx_comments_workspace ON comments(workspace_id);
CREATE INDEX idx_comments_document ON comments(document_id);
CREATE INDEX idx_comments_version ON comments(document_version_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- Updated at trigger
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- File: 010_guest_links.sql
-- 010_guest_links.sql
-- Secure guest sharing links

CREATE TYPE guest_permission AS ENUM (
  'timeline', 'documents', 'versions', 'comments', 'blockchain'
);

CREATE TABLE guest_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  created_by UUID REFERENCES profiles(id),
  permissions guest_permission[] DEFAULT ARRAY['timeline', 'documents', 'versions', 'comments', 'blockchain'],
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE guest_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Creators can manage guest links" ON guest_links
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Admins can view all guest links" ON guest_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = guest_links.workspace_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_guest_links_token ON guest_links(token);
CREATE INDEX idx_guest_links_workspace ON guest_links(workspace_id);
CREATE INDEX idx_guest_links_document ON guest_links(document_id);
CREATE INDEX idx_guest_links_created_by ON guest_links(created_by);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE guest_links;

-- File: 011_audit_logs.sql
-- 011_audit_logs.sql
-- Audit logs for sensitive operations

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = audit_logs.workspace_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- File: 012_rls.sql
-- 012_rls.sql
-- Consolidated RLS policies for all tables (already defined in individual migrations)
-- This file ensures RLS is enabled on all tables

-- Verify RLS is enabled on all tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- File: 013_realtime.sql
-- 013_realtime.sql
-- Enable realtime for tables that need live updates

-- Already enabled in individual migrations:
-- timeline_events, comments, guest_links, documents, blockchain_blocks

-- Ensure all required tables are in the publication
DO $$
DECLARE
  tables TEXT[] := ARRAY['documents', 'document_versions', 'blockchain_blocks', 'blockchain_transactions', 'timeline_events', 'comments', 'guest_links'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END LOOP;
END $$;

-- File: 014_functions.sql
-- 014_functions.sql
-- Core database functions for blockchain operations

-- SHA-256 hash calculation functions
CREATE OR REPLACE FUNCTION calculate_block_hash(
  p_previous_hash TEXT,
  p_timestamp TIMESTAMPTZ,
  p_transaction_hash TEXT,
  p_payload_hash TEXT,
  p_nonce BIGINT
) RETURNS TEXT AS $$
  SELECT encode(sha256(p_previous_hash || p_timestamp::text || p_transaction_hash || p_payload_hash || p_nonce::text), 'hex');
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_transaction_hash(
  p_event_type TEXT,
  p_actor_id UUID,
  p_document_id UUID,
  p_payload JSONB
) RETURNS TEXT AS $$
  SELECT encode(sha256(p_event_type || p_actor_id::text || COALESCE(p_document_id::text, '') || p_payload::text), 'hex');
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_payload_hash(p_payload JSONB) RETURNS TEXT AS $$
  SELECT encode(sha256(p_payload::text), 'hex');
$$ LANGUAGE sql IMMUTABLE;

-- Create genesis block for a workspace
CREATE OR REPLACE FUNCTION create_genesis_block(p_workspace_id UUID) RETURNS UUID AS $$
DECLARE
  v_block_hash TEXT;
  v_block_id UUID;
BEGIN
  v_block_hash := calculate_block_hash(
    '0', NOW(), 'genesis', 'genesis', 0
  );
  INSERT INTO blockchain_blocks (workspace_id, block_index, previous_hash, timestamp, transaction_hash, payload_hash, block_hash, nonce)
  VALUES (p_workspace_id, 0, '0', NOW(), 'genesis', 'genesis', v_block_hash, 0)
  RETURNING id INTO v_block_id;
  RETURN v_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Append a new blockchain event atomically (transaction + block + timeline)
CREATE OR REPLACE FUNCTION append_blockchain_event(
  p_workspace_id UUID,
  p_event_type blockchain_event_type,
  p_actor_id UUID,
  p_document_id UUID DEFAULT NULL,
  p_document_version_id UUID DEFAULT NULL,
  p_payload JSONB
) RETURNS UUID AS $$
DECLARE
  v_transaction_hash TEXT;
  v_payload_hash TEXT;
  v_previous_hash TEXT;
  v_block_index BIGINT;
  v_block_hash TEXT;
  v_nonce BIGINT := 0;
  v_block_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Calculate hashes
  v_transaction_hash := calculate_transaction_hash(p_event_type, p_actor_id, p_document_id, p_payload);
  v_payload_hash := calculate_payload_hash(p_payload);
  
  -- Get latest block
  SELECT block_hash, block_index INTO v_previous_hash, v_block_index
  FROM blockchain_blocks
  WHERE workspace_id = p_workspace_id
  ORDER BY block_index DESC
  LIMIT 1;
  
  IF v_previous_hash IS NULL THEN
    -- Create genesis if not exists
    PERFORM create_genesis_block(p_workspace_id);
    SELECT block_hash, block_index INTO v_previous_hash, v_block_index
    FROM blockchain_blocks
    WHERE workspace_id = p_workspace_id
    ORDER BY block_index DESC
    LIMIT 1;
  END IF;
  
  v_block_index := v_block_index + 1;
  
  -- Simple proof of work (find hash with 4 leading zeros)
  LOOP
    v_block_hash := calculate_block_hash(v_previous_hash, NOW(), v_transaction_hash, v_payload_hash, v_nonce);
    IF v_block_hash LIKE '0000%' THEN
      EXIT;
    END IF;
    v_nonce := v_nonce + 1;
  END LOOP;
  
  -- Insert transaction
  INSERT INTO blockchain_transactions (workspace_id, event_type, actor_id, document_id, document_version_id, payload, payload_hash, transaction_hash)
  VALUES (p_workspace_id, p_event_type, p_actor_id, p_document_id, p_document_version_id, p_payload, v_payload_hash, v_transaction_hash)
  RETURNING id INTO v_transaction_id;
  
  -- Insert block
  INSERT INTO blockchain_blocks (workspace_id, block_index, previous_hash, timestamp, transaction_hash, payload_hash, block_hash, nonce)
  VALUES (p_workspace_id, v_block_index, v_previous_hash, NOW(), v_transaction_hash, v_payload_hash, v_block_hash, v_nonce)
  RETURNING id INTO v_block_id;
  
  -- Insert timeline event
  INSERT INTO timeline_events (workspace_id, event_type, actor_id, document_id, document_version_id, block_id, metadata)
  VALUES (p_workspace_id, p_event_type, p_actor_id, p_document_id, p_document_version_id, v_block_id, p_payload);
  
  RETURN v_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate blockchain integrity for a workspace
CREATE OR REPLACE FUNCTION validate_blockchain(p_workspace_id UUID) RETURNS TABLE(
  block_index BIGINT,
  is_valid BOOLEAN,
  expected_hash TEXT,
  actual_hash TEXT
) AS $$
DECLARE
  v_record RECORD;
  v_previous_hash TEXT := '0';
  v_expected_hash TEXT;
BEGIN
  FOR v_record IN
    SELECT block_index, previous_hash, timestamp, transaction_hash, payload_hash, block_hash, nonce
    FROM blockchain_blocks
    WHERE workspace_id = p_workspace_id
    ORDER BY block_index
  LOOP
    v_expected_hash := calculate_block_hash(
      v_previous_hash, v_record.timestamp, v_record.transaction_hash, v_record.payload_hash, v_record.nonce
    );
    
    RETURN QUERY SELECT v_record.block_index, v_expected_hash = v_record.block_hash, v_expected_hash, v_record.block_hash;
    
    v_previous_hash := v_record.block_hash;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment document version counter
CREATE OR REPLACE FUNCTION increment_document_version(p_doc_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE documents SET current_version = current_version + 1, updated_at = NOW() WHERE id = p_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get public documents for public API
CREATE OR REPLACE FUNCTION get_public_documents(p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID, filename TEXT, original_filename TEXT, mime_type TEXT,
  size_bytes BIGINT, sha256 TEXT, current_version INTEGER,
  created_at TIMESTAMPTZ, workspace_name TEXT
) AS $$
  SELECT d.id, d.filename, d.original_filename, d.mime_type, d.size_bytes,
    d.sha256, d.current_version, d.created_at, w.name as workspace_name
  FROM documents d
  JOIN workspaces w ON w.id = d.workspace_id
  WHERE d.visibility = 'public' AND w.visibility = 'public' AND d.status = 'active'
  ORDER BY d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get public timeline for a document
CREATE OR REPLACE FUNCTION get_public_timeline(p_document_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID, event_type TEXT, actor_name TEXT, timestamp TIMESTAMPTZ,
  version_number INTEGER, block_index BIGINT, block_hash TEXT
) AS $$
  SELECT te.id, te.event_type, p.full_name as actor_name, te.created_at,
    dv.version_number, bb.block_index, bb.block_hash
  FROM timeline_events te
  LEFT JOIN profiles p ON p.id = te.actor_id
  LEFT JOIN document_versions dv ON dv.id = te.document_version_id
  LEFT JOIN blockchain_blocks bb ON bb.id = te.block_id
  WHERE te.document_id = p_document_id
  AND EXISTS (
    SELECT 1 FROM documents d
    JOIN workspaces w ON w.id = d.workspace_id
    WHERE d.id = p_document_id AND d.visibility = 'public' AND w.visibility = 'public'
  )
  ORDER BY te.created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Verify document by SHA-256
CREATE OR REPLACE FUNCTION verify_document_hash(p_sha256 TEXT)
RETURNS TABLE (
  id UUID, filename TEXT, original_filename TEXT, mime_type TEXT,
  size_bytes BIGINT, sha256 TEXT, current_version INTEGER,
  uploaded_by UUID, created_at TIMESTAMPTZ,
  workspace_id UUID, workspace_name TEXT,
  version_id UUID, version_number INTEGER, version_sha256 TEXT,
  block_index BIGINT, block_hash TEXT, chain_valid BOOLEAN
) AS $$
DECLARE
  v_doc RECORD;
  v_version RECORD;
  v_block RECORD;
BEGIN
  -- Find document with matching hash (current or any version)
  SELECT d.* INTO v_doc
  FROM documents d
  WHERE d.sha256 = p_sha256
  OR EXISTS (
    SELECT 1 FROM document_versions dv WHERE dv.document_id = d.id AND dv.sha256 = p_sha256
  )
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find matching version
  SELECT * INTO v_version
  FROM document_versions
  WHERE document_id = v_doc.id AND sha256 = p_sha256
  LIMIT 1;
  
  -- Get associated blockchain block
  SELECT bb.* INTO v_block
  FROM blockchain_blocks bb
  JOIN blockchain_transactions bt ON bt.id = bb.transaction_hash
  WHERE bt.document_id = v_doc.id AND bt.document_version_id = v_version.id
  LIMIT 1;
  
  -- Validate chain
  DECLARE v_chain_valid BOOLEAN;
  BEGIN
    SELECT bool_and(is_valid) INTO v_chain_valid
    FROM validate_blockchain(v_doc.workspace_id);
  END;
  
  RETURN QUERY SELECT 
    v_doc.id, v_doc.filename, v_doc.original_filename, v_doc.mime_type,
    v_doc.size_bytes, v_doc.sha256, v_doc.current_version,
    v_doc.uploaded_by, v_doc.created_at,
    v_doc.workspace_id, w.name as workspace_name,
    v_version.id as version_id, v_version.version_number, v_version.sha256,
    v_block.block_index, v_block.block_hash, v_chain_valid as chain_valid
  FROM documents v_doc
  JOIN workspaces w ON w.id = v_doc.workspace_id
  JOIN document_versions v_version ON v_version.document_id = v_doc.id AND v_version.sha256 = p_sha256
  LEFT JOIN blockchain_blocks v_block ON v_block.id = (
    SELECT bb.id FROM blockchain_blocks bb
    JOIN blockchain_transactions bt ON bt.id = bb.transaction_hash
    WHERE bt.document_id = v_doc.id AND bt.document_version_id = v_version.id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- File: 015_triggers.sql
-- 015_triggers.sql
-- Updated_at triggers for all tables

-- Updated_at trigger function (already created in 002_profiles.sql)
-- Apply to all tables with updated_at column

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_versions_updated_at BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_links_updated_at BEFORE UPDATE ON guest_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- File: 016_public_visibility.sql
-- 016_public_visibility.sql
-- Public visibility model for documents and workspaces

-- Visibility type already created in 003_workspaces.sql and 005_documents.sql
-- Add visibility column to workspaces (already exists)
-- Add visibility column to documents (already exists)

-- Indexes for public queries
CREATE INDEX idx_workspaces_public ON workspaces(visibility) WHERE visibility = 'public';
CREATE INDEX idx_documents_public ON documents(visibility) WHERE visibility = 'public';

-- RLS: Public read access for public workspaces/documents
CREATE POLICY "Public can view public workspaces" ON workspaces
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "Public can view public documents" ON documents
  FOR SELECT USING (
    visibility = 'public' 
    AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = documents.workspace_id AND w.visibility = 'public')
  );

-- Blockchain/Timeline: Public read for public documents
CREATE POLICY "Public can view public timeline" ON timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE d.id = timeline_events.document_id 
      AND d.visibility = 'public' 
      AND w.visibility = 'public'
    )
  );

CREATE POLICY "Public can view public blockchain" ON blockchain_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE d.id = (
        SELECT document_id FROM blockchain_transactions bt WHERE bt.id = blockchain_blocks.transaction_hash
      )
      AND d.visibility = 'public' 
      AND w.visibility = 'public'
    )
  );