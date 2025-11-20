CREATE TABLE IF NOT EXISTS anotaciones (
  id BIGINT PRIMARY KEY,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  posicion JSONB NOT NULL,
  rotacion JSONB NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'bars'
);
