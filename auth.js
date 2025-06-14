import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Email sign in error:', error);
    return { data: null, error };
  } 
}

export async function signUpWithEmail(email, password) {
   try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Email sign up error:', error);
    return { data: null, error };
  } 
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    chrome.storage.local.clear();
    chrome.identity.clearAllCachedAuthTokens();
    supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  } 
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user) return { user, error: null };
  return { user: null, error };
}

export async function resetPassword(email) {
   try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  } 
}

export async function signInWithGoogle() {
  try {
    const manifest = chrome.runtime.getManifest();
    
    const authURL = new URL('https://accounts.google.com/o/oauth2/auth');
    authURL.searchParams.set('client_id', manifest.oauth2.client_id);
    authURL.searchParams.set('response_type', 'id_token');
    authURL.searchParams.set('access_type', 'offline');
    authURL.searchParams.set('prompt', 'select_account');
    authURL.searchParams.set('redirect_uri', `https://dknmebcamfpnjhijpomlgdlcipchlbka.chromiumapp.org`);
    authURL.searchParams.set('scope', manifest.oauth2.scopes.join(' '));
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authURL.toString(),
          interactive: true,
        },
        async (redirectedTo) => {
          if (chrome.runtime.lastError) {
            console.error('Auth flow error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          try {
            const url = new URL(redirectedTo);
            // Extract the hash fragment and remove the leading #
            const hashFragment = url.hash.substring(1);
            const params = new URLSearchParams(hashFragment);
            const idToken = params.get('id_token');
            if (!idToken) {
              throw new Error('No ID token received');
            }

            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: idToken,
            });

            if (error) throw error;
            resolve({ data, error: null });
          } catch (error) {
            console.error('Token exchange error:', error);
            resolve({ data: null, error });
          }
        }
      );
    });

  } catch (error) {
    console.error('Google sign in error:', error);
    return { data: null, error };
  }
} 
