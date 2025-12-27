import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuznwaufdduvmhdpkhkp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1em53YXVmZGR1dm1oZHBraGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTYxOTgsImV4cCI6MjA2NTc3MjE5OH0.E53YzHoeqtOQb_2s9nAaBWCm1vteboEC4ngDLma8YKw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 