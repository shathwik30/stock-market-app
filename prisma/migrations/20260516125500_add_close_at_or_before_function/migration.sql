CREATE OR REPLACE FUNCTION close_at_or_before(
  timestamps double precision[],
  closes double precision[],
  target double precision
) RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  lo integer := array_lower(timestamps, 1);
  hi integer := array_upper(timestamps, 1);
  mid integer;
  best integer := NULL;
  close_value double precision;
BEGIN
  IF lo IS NULL OR hi IS NULL THEN
    RETURN NULL;
  END IF;

  WHILE lo <= hi LOOP
    mid := floor((lo + hi) / 2)::integer;

    IF timestamps[mid] <= target THEN
      best := mid;
      lo := mid + 1;
    ELSE
      hi := mid - 1;
    END IF;
  END LOOP;

  IF best IS NULL THEN
    RETURN NULL;
  END IF;

  close_value := closes[best];
  IF close_value IS NULL OR close_value <= 0 THEN
    RETURN NULL;
  END IF;

  RETURN close_value;
END;
$$;
