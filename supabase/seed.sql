-- Tape — seed the preset crew (run once, after schema.sql).
-- Edit names, colors and 4-digit PINs below. PINs are stored as bcrypt hashes
-- via crypt()/gen_salt('bf'); the raw PIN is never persisted.
--
-- To change a PIN later:
--   update public.users set pin_hash = crypt('1234', gen_salt('bf')) where name = 'Miguel';

insert into public.users (name, color, pin_hash) values
  ('Miguel', '#4f8cff', crypt('1234', gen_salt('bf'))),
  ('Bro 1',  '#ff6b6b', crypt('1111', gen_salt('bf'))),
  ('Bro 2',  '#2ecc71', crypt('2222', gen_salt('bf'))),
  ('Bro 3',  '#f7b731', crypt('3333', gen_salt('bf')))
on conflict (name) do nothing;
