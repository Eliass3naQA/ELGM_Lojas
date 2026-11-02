-- Showroom 360° e ficha técnica dos produtos.
-- Rode no SQL Editor do Supabase (projetos criados antes desta versão do schema.sql).
alter table products
  add column if not exists showcase jsonb,                      -- {views: {front, back, left, right, top, bottom, ...}, headlights: [{x,y}], intro}
  add column if not exists specs    jsonb not null default '[]'; -- [{label, value}]
