import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user);
    // Store the session in Chrome storage
    await chrome.storage.local.set({ 
      supabaseSession: session,
      supabaseUser: session?.user 
    });
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    // Clear the session from Chrome storage
    await chrome.storage.local.remove(['supabaseSession', 'supabaseUser']);
  }
});

// Initialize auth state from storage
chrome.storage.local.get(['supabaseSession', 'supabaseUser'], async (result) => {
  if (result.supabaseSession) {
    try {
      // Set the session in Supabase client
      const { error } = await supabase.auth.setSession(result.supabaseSession);
      if (error) {
        console.error('Error setting session:', error);
        return;
      }
      console.log('Session restored from storage');
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }
});

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
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  } 
}

export async function getCurrentUser() {
   try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error) {
    console.error('Get current user error:', error);
    return { user: null, error };
  } 
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
    authURL.searchParams.set('redirect_uri', `https://dknmebcamfpnjhijpomlgdlcipchlbka.chromiumapp.org`);
    authURL.searchParams.set('scope', manifest.oauth2.scopes.join(' '));
    console.log(chrome.runtime.id);
    console.log(`https://${chrome.runtime.id}.chromiumapp.org/`);
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
            const user = await supabase.auth.getUser();
            console.log(user);
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

// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create menu items directly in the context menu
  chrome.contextMenus.create({
    id: "option1",
    title: "Option 11",
    contexts: ["all"]
  });

});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "option1":
      // Get user from storage first
      const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
      if (!supabaseUser) {
        console.log("No user found in storage, trying to get from Supabase");
        const { user, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        console.log("user is " + user);
      } else {
        console.log("user from storage is " + supabaseUser);
      }

      console.log("Option 11 clicked");
      const content = "test";
      const dataset_id = "1";
      const data_point_id = "1";
      const label = "test";
      const { data: dataPoint, error: dataPointError } = await supabase
        .from('data_points')
        .insert({
          user_id: supabaseUser?.id || user.id,
          content: content.trim()
        })
        .select()
        .single()

      if (dataPointError) throw dataPointError;

      // Create the association
      const { error: associationError } = await supabase
        .from('dataset_data_points')
        .insert({
          dataset_id: selectedDataset,
          data_point_id: dataPoint.id,
          label: label.trim()
        });

      if (associationError) throw associationError;
      break;
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "action1":
      console.log("Action 1 triggered by keyboard shortcut");
      // Add your action1 logic here
      break;
    case "action2":
      console.log("Action 2 triggered by keyboard shortcut");
      // Add your action2 logic here
      break;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openSidePanel',
    title: 'Open side panel',
    contexts: ['all']
  });
  chrome.tabs.create({ url: 'page.html' });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidePanel') {
    // Get the current window ID first
    chrome.windows.getCurrent(async (window) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting current window:', chrome.runtime.lastError);
        return;
      }
      
      try {
        // Open the side panel for the current window
        await chrome.sidePanel.open({ windowId: window.id });
      } catch (error) {
        console.error('Error opening side panel:', error);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  // The callback for runtime.onMessage must return falsy if we're not sending a response
  (async () => {
    console.log("message is ", message);
    // Handle other message types here if needed
  })();
});