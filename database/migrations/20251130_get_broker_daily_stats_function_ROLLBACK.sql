-- Rollback: Remove get_broker_daily_stats function

DROP FUNCTION IF EXISTS get_broker_daily_stats(uuid);

