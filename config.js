const { useState, useEffect, useCallback, useRef } = React;

    // ==============================================================================
    // KONFIGURASI UTAMA
    // ==============================================================================
    const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
    const STATUS = { SUCCESS: "success", ERROR: "error" };
    const ROLES = { ADMIN: "admin", GURU: "guru", SISWA: "siswa" };

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Utility: Penghitung Waktu Mundur
    const calculateTimeLeft = (endTime) => {
      const difference = new Date(endTime) - new Date();
      if (difference <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        total: difference,
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };
