-- Add viewer role to member_role enum
alter type member_role add value if not exists 'viewer';
