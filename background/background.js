import { initalize_storage_variables } from './chrome_storage_variables.js';
import { getCurrentUser, signInWithGoogle } from './auth.js';
import { supabase, restoreSession, setupAuthStateListener } from './supabaseClient.js';

await restoreSession();
await initalize_storage_variables();

chrome.contextMenus.remove("option1", () => {
  if (chrome.runtime.lastError) {
    console.log('Error removing context menu:', chrome.runtime.lastError);
  }
});

chrome.contextMenus.create({
  id: "option1",
  title: "Remember This!", // Initial state is "question"
  contexts: ["selection"]  // Only show when text is selected
});

// Main body of APIs provided by background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Inefficient to restore session every time? But gives guarantees that session is valid.
  (async () => {
    try {
     await restoreSession();
    }
    catch (error) {
      // Only send error response if it's a critical error, not just missing session
      console.log('Session restoration failed:', error.message);
      // Don't send error response for missing session - let the request continue
    }
  })();

  switch (request.type) {
    case 'GOOGLE_SIGN_IN':
      handleGoogleSignIn()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ data: null, error }));
      return true; // Required for async sendResponse
      
    case 'UPDATE_DATA_POINT':
      update_to_dataset(request.question, request.answer, request.dataset);
      return true;
      
    case 'ADD_DATA_POINT':
      (async () => { 
        try {
          const { selectedDataset } = await chrome.storage.local.get(['selectedDataset']);
          if (!selectedDataset) throw new Error('No dataset selected');
          await add_to_dataset(request.question, request.answer, selectedDataset);
          sendResponse({ data: 'success', error: null });
        }
        catch (error) {
          sendResponse({ data: null, error });
        }
      })();
      return true;
      
    case 'REAUTH_REQUIRED':
      // Handle re-authentication requirement
      console.log('Re-authentication required, clearing session data');
      chrome.storage.local.remove(['supabaseSession', 'supabaseUser', 'selectedDataset']);
      // You could also open the popup to prompt for re-authentication
      chrome.action.openPopup();
      return true;

    case 'SELECT_DATASET':
      // This refers to the dataset ID, not the dataset name
      chrome.storage.local.set({ selectedDataset: request.dataset });
      return true;

    case 'GET_DATASET_NAMES_LIST':
      (async () => {
        try {
          const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
          const { data: datasets, error: datasetsError } = await supabase
            .from('datasets')
            .select('id, name')
            .eq('user_id', supabaseUser.id);
          if (datasetsError) throw datasetsError;
          sendResponse({ data: datasets, error: null });
        } catch (error) {
          console.error('Error getting dataset names list:', error);
          sendResponse({ data: null, error: error });
        }
      })();
      return true;

    case 'CREATE_DATASET':
      (async () => {
        try {
          const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
          const { data: newDataset, error: createError } = await supabase
            .from('datasets')
            .insert({
              name: request.datasetName,
              user_id: supabaseUser.id
            })
            .select('id, name')
            .single();
          if (createError) throw createError;
          sendResponse({ data: newDataset, error: null });
        } catch (error) {
          sendResponse({ data: null, error });
        }
      })();
      return true;
    case 'SIGN_IN_WITH_EMAIL':
      (async () => {
        try {
          const { signInWithEmail } = await import('./auth.js');
          const { data, error } = await signInWithEmail(request.email, request.password);
          sendResponse({ data, error });
        } catch (error) {
          sendResponse({ data: null, error });
        }
      })();
      return true;
    case 'SIGN_UP_WITH_EMAIL':
      (async () => {
        try {
          const { signUpWithEmail } = await import('./auth.js');
          const { data, error } = await signUpWithEmail(request.email, request.password);
          sendResponse({ data, error });
        } catch (error) {
          sendResponse({ data: null, error });
        }
      })();
      return true;
    case 'SIGN_OUT':
      (async () => {
        try {
          const { signOut } = await import('./auth.js');
          const { error } = await signOut();
          sendResponse({ error });
        } catch (error) {
          sendResponse({ error });
        }
      })();
      return true;
    case 'GET_CURRENT_USER':
      (async () => {
        try {
          const { user, error } = await getCurrentUser();
          sendResponse({ user, error });
        } catch (error) {
          sendResponse({ user: null, error });
        }
      })();
      return true;
  }
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel immediately in response to user gesture
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Create context menu items and handle browser installation when the extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  // Set up the side panel configuration
  chrome.sidePanel.setOptions({
    path: 'ui/sidepanel.html',
    enabled: true
  });
  
  setupAuthStateListener();
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
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "action1":
      (async () => {
        try {
          await run_auto(info);
        }
        catch (error) {
          console.error("Error in run_auto:", error);
        }
      })();
      break;
  }
});

var current_data_point_id = null;
async function add_to_dataset(selected_question, selected_label, selected_dataset) {
  const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
  // Ensure selected_dataset is a string (dataset ID)
  // Create the data point
  const { data: dataPoint, error: dataPointError } = await supabase
    .from('data_points')
    .insert({
      user_id: supabaseUser?.id,
      content: selected_question.trim(),
      label: selected_label.trim()
    })
    .select()
    .single();

  if (dataPointError) throw dataPointError;
  current_data_point_id = dataPoint.id;

  // Create the association
  const { error: associationError } = await supabase
    .from('dataset_data_points')
    .insert({
      dataset_id: selected_dataset, // Use the actual dataset ID
      data_point_id: dataPoint.id
    });

  if (associationError) throw associationError;
}

async function update_to_dataset(selected_question, selected_label, selected_dataset) {
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

  if (!current_data_point_id) {
    show_status("No data point selected, please add a question.");
    return;
  }
  // Create the data point
  const { data: dataPoint, error: dataPointError } = await supabase
    .from('data_points')
    .update({
      content: selected_question.trim(),
      label: selected_label.trim()
    })
    .eq('id', current_data_point_id);

  if (dataPointError) throw dataPointError;

  // Create the association
  const { error: associationError } = await supabase
    .from('dataset_data_points')
    .insert({
      dataset_id: selected_dataset, // Use the actual dataset ID
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
    const { selectedDataset } = await chrome.storage.local.get(['selectedDataset']);
    if (!selectedDataset) {
      console.log("No dataset selected");
      return;
    }
    addition_state = "question"
    updateContextMenuTitle(); // Update menu title after state change
    var status = await add_to_dataset(question, label, selectedDataset)
    console.log("Status:", status);
  }
  const { selectedDataset } = await chrome.storage.local.get(['selectedDataset']);
  console.log("Using dataset:", selectedDataset);
  console.log("Selected question:", question);
}


export async function run_auto(info) {
  console.log("Running auto");
  if (!info.selectionText) {
    console.log("No text selected");
    return;
  }
  const { selectedDataset } = await chrome.storage.local.get(['selectedDataset']);
  if (!selectedDataset) {
    chrome.runtime.sendMessage({
      type: 'SHOW_STATUS',
      message: 'Please select a dataset first',
      statusType: 'error'
    });
    return;
  }

  try {
    var result = await chrome.storage.local.get(["system_prompt"]);
    var prompt = result.system_prompt + " Text: " + info.selectionText;
    const { data, errors } = await supabase.functions.invoke('llm-proxy', {
      body: {
        name: 'Functions',
        prompt: prompt
       },
    })
    console.log(data);
    const questionMatch = data.match(/###QUESTION###(.*?)###ANSWER###/s);
    const answerMatch = data.match(/###ANSWER###(.*?)$/s);
    
    if (!questionMatch || !answerMatch) {
      console.log("Could not parse question/answer from response");
      return;
    }

    const question = questionMatch[1].trim();
    const answer = answerMatch[1].trim();

    console.log("Selected dataset:", selectedDataset);
    var status = await add_to_dataset(question, answer, selectedDataset)
    console.log("Status:", status);


    chrome.runtime.sendMessage({
      type: 'LOAD_QA',
      question: question,
      answer: answer
    });
  } catch (error) {
    console.error("Error in run_auto:", error);
  }
}

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
  }
});

// Modes: manual, auto
// Manual is where user manually chooses question and answer
// Auto is where LLM generates it
// Function to update context menu title based on state
// TODO: Modify to include mode state, possibly move to gen_functions.js
function updateContextMenuTitle() {
  const title = addition_state === "question" ? "Add question to dataset" : "Add answer to dataset";
  chrome.contextMenus.update("option1", { title });
}

async function handleGoogleSignIn() {
  const result = await signInWithGoogle();
  return result;
}