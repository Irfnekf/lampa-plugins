-- LMX Sync: одна таблиця. u — хеш особистого коду користувача, k — ключ запису, v — JSON, t — час зміни (мс, з пристрою),
-- d — 1 якщо запис видалено, st — час запису на сервері (для вибірки «що змінилось відтоді»).
CREATE TABLE IF NOT EXISTS kv (
  u  TEXT    NOT NULL,
  k  TEXT    NOT NULL,
  v  TEXT,
  t  INTEGER NOT NULL,
  d  INTEGER NOT NULL DEFAULT 0,
  st INTEGER NOT NULL,
  PRIMARY KEY (u, k)
);
CREATE INDEX IF NOT EXISTS kv_st ON kv (u, st);
