import { supabase, restoreSession } from '../background/supabaseClient.js';

// DOM Elements
const userEmailElement = document.getElementById('userEmail');
const datasetSelect = document.getElementById('datasetSelect');
const statusElement = document.getElementById('status');

const questionText = document.getElementById('questionText');
const answerText = document.getElementById('answerText');
const updateQuestionsBtn = document.getElementById('updateQuestions');
const addQuestionsBtn = document.getElementById('addQuestions');

// Initialize
async function initialize() {
  // First restore the session
  const sessionRestored = await restoreSession();
  
  // Load user data
  const user = await loadUserData();
  console.log("User returned: ", user);
  
  if (user && user.id) {
    console.log("User ID: ", user.id);
    await loadDatasets(user.id);
  } else {
    console.log("No user found or user has no ID");
    showStatus('Please sign in to continue', 'error');
  }
}

// Show status message
function showStatus(message, type = 'success') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  setTimeout(() => {
    statusElement.className = 'status';
  }, 3000);
}

// Load user data
async function loadUserData() {
  try {
    // First try to get from storage
    const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
    console.log("SupabaseUser: ", supabaseUser);
  
    // Careful with this check
    if (supabaseUser.email) {
      userEmailElement.textContent = supabaseUser.email;
      console.log("Returning supabaseUser", supabaseUser);
      return supabaseUser;
    }
    console.log("No supabaseUser in storage");
    // If not in storage, try to get from Supabase
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    console.log("Error after supabase.auth.getUser: ", error);  

    if (user) {
      userEmailElement.textContent = user.email;
      console.log("Returning user", user);
      return user;
    }

    throw new Error('No user found');
  } catch (error) {
    console.error('Error loading user:', error);
    showStatus('Error loading user data', 'error');
    return null;
  }
}

// Load datasets for the user
async function loadDatasets(userId) {
  try {
    const { data: datasets, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    console.log(datasets)

    if (error) throw error;

    // Clear existing options
    datasetSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a dataset --';
    datasetSelect.appendChild(defaultOption);

    // Add dataset options
    datasets.forEach(dataset => {
      const option = document.createElement('option');
      option.value = dataset.id;
      option.textContent = dataset.name;
      datasetSelect.appendChild(option);
    });

    // Get the last selected dataset from storage
    const { selectedDataset } = await chrome.storage.local.get(['selectedDataset']);
    if (selectedDataset) {
      datasetSelect.value = selectedDataset;
    }
  } catch (error) {
    console.error('Error loading datasets:', error);
    showStatus('Error loading datasets', 'error');
  }
}

// Handle dataset selection
datasetSelect.addEventListener('change', async () => {
  const datasetId = datasetSelect.value;
  
  try {
    // Store the selection in Chrome storage
    await chrome.storage.local.set({ selectedDataset: datasetId });
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'DATASET_SELECTED',
      datasetId: datasetId
    });
    
    showStatus('Dataset selected');
  } catch (error) {
    console.error('Error saving dataset selection:', error);
    showStatus('Error saving selection', 'error');
  }
});

// Generate questions
updateQuestionsBtn.addEventListener('click', async () => {
  
  try {
    chrome.runtime.sendMessage({
      type: 'UPDATE_DATA_POINT',
      question: questionText.value,
      answer: answerText.value,
      dataset: datasetSelect.value
    });
    showStatus('Data point updated'); 
  } catch (error) {
    console.error('Error updating data point:', error);
    showStatus('Error updating data point', 'error');
  } 
});

// Add questions manually
addQuestionsBtn.addEventListener('click', async () => {
  try {
    chrome.runtime.sendMessage({
      type: 'ADD_DATA_POINT',
      question: questionText.value,
      answer: answerText.value,
      dataset: datasetSelect.value
    });
    showStatus('Data point added'); 
  } catch (error) {
    console.error('Error adding data point:', error);
    showStatus('Error adding data point', 'error');
  } 
});

// Start initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOAD_QA') {
    console.log("Loading QA");
    if (request.question && request.answer) {
      questionText.value = request.question;
      answerText.value = request.answer;
    } else {
      console.error('Question or answer input elements not found');
    }
  }
});

// Handle status messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHOW_STATUS') {
    showStatus(request.message, request.statusType);
  } else if (request.type === 'REAUTH_REQUIRED') {
    // Handle re-authentication requirement
    console.log('Re-authentication required in sidepanel');
    showStatus('Please sign in again to continue', 'error');
    // Clear the UI
    userEmailElement.textContent = '';
    datasetSelect.innerHTML = '';
  }
});
