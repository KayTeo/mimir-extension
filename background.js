import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variable to store the selected dataset ID
let selectedDataset = null;

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
    await chrome.storage.local.remove(['supabaseSession', 'supabaseUser', 'selectedDataset']);
    selectedDataset = null;
  }
});

// Initialize auth state from storage
chrome.storage.local.get(['supabaseSession', 'supabaseUser', 'selectedDataset'], async (result) => {
  if (result.supabaseSession) {
    try {
      // Set the session in Supabase client
      const { error } = await supabase.auth.setSession(result.supabaseSession);
      if (error) {
        console.error('Error setting session:', error);
        return;
      }
      console.log('Session restored from storage');
      
      // Restore selected dataset
      if (result.selectedDataset) {
        selectedDataset = result.selectedDataset;
        console.log('Restored selected dataset:', selectedDataset);
      }
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

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender) => {
  // The callback for runtime.onMessage must return falsy if we're not sending a response
  (async () => {
    console.log("Received message:", message);
    
    if (message.type === 'DATASET_SELECTED') {
      selectedDataset = message.datasetId;
      console.log('Dataset selected:', selectedDataset);
      
      // You can perform any additional actions here when the dataset changes
    }
  })();
});

// Function to update context menu title based on state
function updateContextMenuTitle() {
  const title = addition_state === "question" ? "Add question to dataset" : "Add answer to dataset";
  chrome.contextMenus.update("option1", { title });
}

// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "option1",
    title: "Add question to dataset", // Initial state is "question"
    contexts: ["selection"]  // Only show when text is selected
  });
});

async function add_to_dataset(selected_question, selected_label, selected_dataset) {
      // Get user from storage first
      const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
      if (!supabaseUser) {
        console.log("No user found in storage, trying to get from Supabase");
        const { user, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        console.log("user is", user);
      } else {
        console.log("user from storage is", supabaseUser);
      }
      
      // Create the data point
      const { data: dataPoint, error: dataPointError } = await supabase
        .from('data_points')
        .insert({
          user_id: supabaseUser?.id || user.id,
          content: selected_question.trim(),
          label: selected_label.trim()
        })
        .select()
        .single();

      if (dataPointError) throw dataPointError;

      // Create the association
      const { error: associationError } = await supabase
        .from('dataset_data_points')
        .insert({
          dataset_id: selectedDataset,
          data_point_id: dataPoint.id
        });

      if (associationError) throw associationError;
}

var addition_state = "question" //Varies between content and label on alternate clicks
var question = ""
var label = ""

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "option1":
      if (addition_state == "question") {
        question = info.selectionText;
        if (!question) {
          console.log("No question text selected");
          return;
        }
        addition_state = "label"
        updateContextMenuTitle(); // Update menu title after state change
      } else {
        label = info.selectionText;
        if (!label) {
          console.log("No label text selected");
          return;
        }

        if (!selectedDataset) {
          console.log("No dataset selected");
          return;
        }

        addition_state = "question"
        updateContextMenuTitle(); // Update menu title after state change
        var status = await add_to_dataset(question, label, selectedDataset)
        console.log("Status:", status);
      }

      console.log("Using dataset:", selectedDataset);
      console.log("Selected question:", question);
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
