import { supabase, signInWithGoogle } from './auth.js';
import { initalize_storage_variables } from './chrome_storage_variables.js';

//TODO: Write update version for sidepanel
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

export async function run_manual(info) {
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
}


export async function run_auto(info) {
  console.log("Running auto");
  if (!info.selectionText) {
    console.log("No text selected");
    return;
  }

  try {
    var result = await chrome.storage.local.get(["system_prompt"]);
    var prompt = result.system_prompt + " Text: " + info.selectionText;
    console.log("Result: ", result);
    console.log(result.system_prompt);
    console.log("Prompt: ", prompt);

    const { data, errors } = await supabase.functions.invoke('llm-proxy', {
      body: {
        name: 'Functions',
        prompt: prompt
       },
    })
    console.log(data);
    //TODO: Parse response into Q/A
    //TODO: Insert into datasaet
    //TODO: Update sidepanel with new questions
  } catch (error) {
  }
}
// Handle browser startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Browser started up - initializing extension');
  // Initialize storage variables
  await initalize_storage_variables();

  // Restore session if it exists
  const result = await chrome.storage.local.get(['supabaseSession', 'supabaseUser', 'selectedDataset']);
  if (result.supabaseSession) {
    try {
      const { error } = await supabase.auth.setSession(result.supabaseSession);
      if (error) {
        console.error('Error setting session:', error);
        return;
      }
      console.log('Session restored from storage on startup');
      
      if (result.selectedDataset) {
        selectedDataset = result.selectedDataset;
        console.log('Restored selected dataset on startup:', selectedDataset);
      }
    } catch (error) {
      console.error('Error restoring session on startup:', error);
    }
  }
});

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
// TODO: Handle when not logged in at first
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

// Modes: manual, auto
// Manual is where user manually chooses question and answer
// Auto is where LLM generates it
chrome.storage.local.set({ "mode" : "auto"})
// Function to update context menu title based on state
// TODO: Modify to include mode state, possibly move to gen_functions.js
function updateContextMenuTitle() {
  const title = addition_state === "question" ? "Add question to dataset" : "Add answer to dataset";
  chrome.contextMenus.update("option1", { title });
}

// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "option1",
    title: "Remember This!", // Initial state is "question"
    contexts: ["selection"]  // Only show when text is selected
  });
});


// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "option1":
      console.log("Context menu clicked");
      const result = await chrome.storage.local.get(['mode']);
      const mode = result.mode;
      console.log("Mode: ", mode);
      if (mode === "manual") await run_manual(info);
      if (mode === "auto") await run_auto(info);
      break;
  }
});

// Handle keyboard commands
// TODO: Support hotkey actions
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


// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GOOGLE_SIGN_IN') {
    handleGoogleSignIn()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ data: null, error }));
    return true; // Required for async sendResponse
  }

});

async function handleGoogleSignIn() {
  const result = await signInWithGoogle();
  if (result.data && !result.error) {
    // Reopen the popup after successful authentication
    chrome.action.openPopup();
  }
  return result;
}
