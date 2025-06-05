import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const userEmailElement = document.getElementById('userEmail');
const datasetSelect = document.getElementById('datasetSelect');
const statusElement = document.getElementById('status');

// Additional DOM Elements
const openaiKeyInput = document.getElementById('openaiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const selectedTextDiv = document.getElementById('selectedText');
const generateQuestionsBtn = document.getElementById('generateQuestions');
const generatedQuestionsDiv = document.getElementById('generatedQuestions');

let currentSelectedText = '';

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
    
    if (supabaseUser) {
      userEmailElement.textContent = supabaseUser.email;
      return supabaseUser;
    }

    // If not in storage, try to get from Supabase
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    if (user) {
      userEmailElement.textContent = user.email;
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

// Load API key if exists
chrome.storage.local.get(['openaiKey'], (result) => {
  if (result.openaiKey) {
    openaiKeyInput.value = result.openaiKey;
  }
});

// Save API key
saveApiKeyBtn.addEventListener('click', async () => {
  const apiKey = openaiKeyInput.value.trim();
  if (apiKey) {
    await chrome.storage.local.set({ openaiKey: apiKey });
    showStatus('API key saved successfully');
  } else {
    showStatus('Please enter an API key', 'error');
  }
});

// Listen for text selection updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEXT_SELECTED') {
    currentSelectedText = message.text;
    selectedTextDiv.innerHTML = `<p>${message.text}</p>`;
    generateQuestionsBtn.disabled = false;
  }
});

// Generate questions
generateQuestionsBtn.addEventListener('click', async () => {
  if (!currentSelectedText) {
    showStatus('Please select some text first', 'error');
    return;
  }

  try {
    generateQuestionsBtn.disabled = true;
    showStatus('Generating questions...');

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_QUESTIONS',
      text: currentSelectedText
    });

    if (response.success) {
      generatedQuestionsDiv.innerHTML = response.questions
        .split('\n')
        .filter(q => q.trim())
        .map(q => `<div class="question-item">${q}</div>`)
        .join('');
      showStatus('Questions generated successfully');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showStatus(`Error generating questions: ${error.message}`, 'error');
  } finally {
    generateQuestionsBtn.disabled = false;
  }
});

// Initialize
async function initialize() {
  const user = await loadUserData();
  if (user) {
    await loadDatasets(user.id);
  }
}

// Start initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 