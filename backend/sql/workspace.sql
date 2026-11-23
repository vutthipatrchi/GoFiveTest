CREATE SCHEMA IF NOT EXISTS performance_workspace;
REVOKE ALL ON SCHEMA performance_workspace FROM PUBLIC;

CREATE TABLE IF NOT EXISTS performance_workspace.workspace (
  id integer PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  workspace jsonb NOT NULL CHECK (jsonb_typeof(workspace) = 'object')
);

ALTER TABLE performance_workspace.workspace ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE performance_workspace.workspace FROM PUBLIC;
