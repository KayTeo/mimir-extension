import { supabase } from './auth.js';
import { run_manual, run_auto } from './gen_functions.js';
import { initalize_storage_variables } from './chrome_storage_variables.js';

// Global variable to store the selected dataset ID
let selectedDataset = null;

// Initialize storage variables
initalize_storage_variables();

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
    title: "Add question to dataset", // Initial state is "question"
    contexts: ["selection"]  // Only show when text is selected
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "option1":
      var mode;
      chrome.storage.local.get(['mode'], (result) => {
        mode = result;
      })
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

// TODO: Investigate generate questions handling
// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The callback for runtime.onMessage must return true if we want to send a response asynchronously
  if (message.type === 'GENERATE_QUESTIONS') {
    (async () => {
      try {
        const questions = await generateQuestions(message.text);
        sendResponse({ success: true, questions });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }
  // ... existing message handling code ...
});

// Function to generate questions using LLM
async function generateQuestions(text) {
  try {
    // You'll need to replace this with your actual LLM API endpoint and key
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await chrome.storage.local.get(['openaiKey']).then(result => result.openaiKey)}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates insightful questions based on given text. Generate questions that test understanding and encourage critical thinking.'
          },
          {
            role: 'user',
            content: `Generate 3 questions based on this text: "${text}"`
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
}
