import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// KONFIGURASI UTAMA
// ==============================================================================
export const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
export const STATUS = { SUCCESS: "success", ERROR: "error" };
export const ROLES = { ADMIN: "admin", GURU: "guru", SISWA: "siswa" };

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility: Penghitung Waktu Mundur
export const calculateTimeLeft = (endTime) => {
      const difference = new Date(endTime) - new Date();
      if (difference <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        total: difference,
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };
