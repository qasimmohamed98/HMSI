ALTER TABLE admissions ADD COLUMN ward_id TEXT REFERENCES wards(id);
ALTER TABLE admissions ADD COLUMN room TEXT;
ALTER TABLE admissions ADD COLUMN bed_no TEXT;