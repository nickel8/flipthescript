-- Add cloud_id to todos so the Mac app can upsert by stable identity
alter table todos add column if not exists cloud_id uuid unique;
