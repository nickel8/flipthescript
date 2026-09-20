-- Store the Vercel Blob URL of the original PDF so the web viewer can display it.
alter table scripts add column if not exists blob_url text;
