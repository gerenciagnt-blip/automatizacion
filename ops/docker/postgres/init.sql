-- =============================================================================
--  ORION — Postgres initialisation
--  Runs once when the postgres container is first brought up.
--  Creates a dedicated `orion_test` database used by integration tests.
-- =============================================================================

CREATE DATABASE orion_test
    WITH OWNER orion
         ENCODING 'UTF8'
         LC_COLLATE 'C'
         LC_CTYPE 'C'
         TEMPLATE template0;
