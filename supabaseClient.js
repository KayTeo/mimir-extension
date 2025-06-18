import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Create a single shared Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to restore session from storage
export async function restoreSession() {
  const { supabaseSession } = await chrome.storage.local.get(['supabaseSession']);
  if (supabaseSession) {
    const { error } = await supabase.auth.setSession(supabaseSession);
    if (error) {
      console.error('Error restoring session:', error);
      if (error.message.includes('Invalid Refresh Token')) {
        console.log('Refresh token invalid - requiring reauthentication');
        await supabase.auth.signOut();
        await chrome.storage.local.remove('supabaseSession');
        chrome.runtime.sendMessage({ type: 'REAUTH_REQUIRED' });
        return false;
      }
      return false;
    }
    return true;
  }
  return false;
}

// Helper function to handle auth state changes
export function setupAuthStateListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      console.log('User signed in:', session?.user);
      await chrome.storage.local.set({ 
        supabaseSession: session,
        supabaseUser: session?.user 
      });
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      await chrome.storage.local.remove(['supabaseSession', 'supabaseUser', 'selectedDataset']);
    }
  });
} 