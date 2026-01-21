-- Enable realtime for sensor_swings table to support live 4B score updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_swings;

-- Also enable realtime for sensor_sessions for session-level updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_sessions;