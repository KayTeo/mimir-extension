import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Create a single shared Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Session management state
let isRestoringSession = false;
let sessionRestorePromise = null;

// Helper function to restore session from storage with coordination
export async function restoreSession() {
  // If already restoring, wait for the existing promise
  if (isRestoringSession && sessionRestorePromise) {
    console.log('Session restore already in progress, waiting...');
    return await sessionRestorePromise;
  }

  // Start new session restore
  isRestoringSession = true;
  sessionRestorePromise = _restoreSessionInternal();
  
  try {
    const result = await sessionRestorePromise;
    return result;
  } catch (error) {
    // Gracefully handle any errors during session restoration
    console.log('Session restoration failed (user may not be logged in):', error.message);
    return false;
  } finally {
    isRestoringSession = false;
    sessionRestorePromise = null;
  }
}

// Internal session restore function
async function _restoreSessionInternal() {
  try {
    const { supabaseSession } = await chrome.storage.local.get(['supabaseSession']);
    if (supabaseSession) {
      // Try to set the session
      const { error } = await supabase.auth.setSession(supabaseSession);
      if (error) {
        if (error.message.includes('Invalid Refresh Token')) {
          console.log('Refresh token invalid - requiring reauthentication');
          await supabase.auth.signOut();
          await chrome.storage.local.remove('supabaseSession');
          chrome.runtime.sendMessage({ type: 'REAUTH_REQUIRED' });
          return false;
        }
        throw error;
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error restoring session:', error);
    return false;
  }
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