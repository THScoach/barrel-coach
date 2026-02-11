-- Widen sequence and transfer_ratio_rating for Reboot imports
ALTER TABLE swing_analysis 
ALTER COLUMN sequence TYPE varchar(100);

ALTER TABLE swing_analysis 
ALTER COLUMN transfer_ratio_rating TYPE varchar(100);