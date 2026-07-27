import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cysccuxxeglomejanjsh.supabase.co';
const supabaseAnonKey = 'sb_publishable_yRQ6L78cn0FlzeChlcCc7g_UThVwenf';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
