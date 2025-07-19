// DOM Elements
const loginState = document.getElementById('loginState');
const appState = document.getElementById('appState');
const loginStatus = document.getElementById('loginStatus');
const statusElement = document.getElementById('status');

// Login form elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const googleSignInBtn = document.getElementById('googleSignIn');

// App elements
const datasetSelect = document.getElementById('datasetSelect');
const questionText = document.getElementById('questionText');
const answerText = document.getElementById('answerText');
const updateQuestionsBtn = document.getElementById('updateQuestions');
const addQuestionsBtn = document.getElementById('addQuestions');
const logoutBtn = document.getElementById('logoutBtn');

// Show/hide states
function showLoginState() {
  loginState.style.display = 'block';
  appState.style.display = 'none';
}

function showAppState() {
  loginState.style.display = 'none';
  appState.style.display = 'block';
}

// Show login status message
function showLoginStatus(message, type = 'success') {
  loginStatus.textContent = message;
  loginStatus.className = `status ${type}`;
  setTimeout(() => {
    loginStatus.className = 'status';
  }, 3000);
}

// Show/hide login forms
function showLoginForm() {
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  clearLoginMessages();
}

function showSignupForm() {
  loginForm.style.display = 'none';
  signupForm.style.display = 'block';
  clearLoginMessages();
}

function clearLoginMessages() {
  loginStatus.className = 'status';
}

// Check authentication state
async function checkAuthState() {
  try {
    const { user, error } = await new Promise((resolve, reject) => {
      // Add timeout and retry logic for service worker communication
      const sendMessageWithRetry = (retryCount = 0) => {
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_USER' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Service worker not ready, retrying...', chrome.runtime.lastError);
            if (retryCount < 3) {
              setTimeout(() => sendMessageWithRetry(retryCount + 1), 500);
            } else {
              reject(new Error('Service worker not responding'));
            }
          } else {
            resolve(response);
          }
        });
      };
      sendMessageWithRetry();
    });

    if (user) {
      showAppState();
      await loadDatasets();
    } else {
      showLoginState();
      showLoginForm();
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    showLoginState();
    showLoginForm();
  }
}

// Initialize
async function initialize() {
  await checkAuthState();
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.selectedDataset) {
    // Update the selected value instead of overwriting innerHTML
    datasetSelect.value = changes.selectedDataset.newValue;
  }
});

// Show status message
function showStatus(message, type = 'success') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  setTimeout(() => {
    statusElement.className = 'status';
  }, 3000);
}

// Helper function for reliable message sending with retry logic
async function sendMessageWithRetry(message, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount = 0) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`Message failed (attempt ${retryCount + 1}):`, chrome.runtime.lastError);
          if (retryCount < maxRetries) {
            setTimeout(() => attempt(retryCount + 1), 500);
          } else {
            reject(new Error(`Service worker not responding after ${maxRetries} attempts`));
          }
        } else {
          resolve(response);
        }
      });
    };
    attempt();
  });
}

// Load datasets for the user
async function loadDatasets() {
  try {
    // Clear existing options
    datasetSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a dataset --';
    datasetSelect.appendChild(defaultOption);

    // Get datasets from background script with retry logic
    try {
      const response = await sendMessageWithRetry({
        type: 'GET_DATASET_NAMES_LIST'
      });
      
      if (response.error) {
        console.error('Error getting datasets:', response.error);
        showStatus('Error loading datasets', 'error');
        return;
      }

      if (response.data && response.data.length > 0) {
        // Add dataset options
        response.data.forEach(dataset => {
          const option = document.createElement('option');
          option.value = dataset.id;
          option.textContent = dataset.name;
          datasetSelect.appendChild(option);
        });
      }

      // Add "Create New Dataset" option
      const createNewOption = document.createElement('option');
      createNewOption.value = 'CREATE_NEW';
      createNewOption.textContent = '+ Create New Dataset';
      datasetSelect.appendChild(createNewOption);

      // Get the last selected dataset from storage
      chrome.storage.local.get(['selectedDataset'], (result) => {
        if (result.selectedDataset && result.selectedDataset !== 'CREATE_NEW') {
          datasetSelect.value = result.selectedDataset;
        }
      });
    } catch (error) {
      console.error('Failed to load datasets:', error);
      showStatus('Error loading datasets', 'error');
    }

  } catch (error) {
    console.error('Error loading datasets:', error);
    showStatus('Error loading datasets', 'error');
  }
}

// Handle dataset selection
datasetSelect.addEventListener('change', async () => {
  const datasetId = datasetSelect.value;
  
  // Handle "Create New Dataset" option
  if (datasetId === 'CREATE_NEW') {
    const datasetName = prompt('Enter the name for your new dataset:');
    if (datasetName && datasetName.trim()) {
      try {
        // Create new dataset via background script with retry logic
        const response = await sendMessageWithRetry({
          type: 'CREATE_DATASET',
          datasetName: datasetName.trim()
        });
        
        if (response.error) {
          console.error('Error creating dataset:', response.error);
          showStatus('Error creating dataset', 'error');
          // Reset to default option
          datasetSelect.value = '';
        } else {
          showStatus('Dataset created successfully!');
          // Set the new dataset as selected
          if (response.data && response.data.id) {
            chrome.storage.local.set({ selectedDataset: response.data.id }, () => {
              // Reload datasets and select the new one after reload
              loadDatasets().then(() => {
                datasetSelect.value = response.data.id;
              });
            });
          } else {
            loadDatasets();
          }
        }
      } catch (error) {
        console.error('Error creating dataset:', error);
        showStatus('Error creating dataset', 'error');
        datasetSelect.value = '';
      }
    } else {
      // User cancelled or entered empty name, reset to default
      datasetSelect.value = '';
    }
    return;
  }
  
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
    await sendMessageWithRetry({
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
    await sendMessageWithRetry({
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

// Handle logout
logoutBtn.addEventListener('click', async () => {
  try {
    const response = await sendMessageWithRetry({ type: 'SIGN_OUT' });
    if (response && response.error) {
      console.error('Logout error:', response.error);
      showStatus('Error logging out', 'error');
    } else {
      showStatus('Logged out successfully');
      showLoginState();
      showLoginForm();
    }
  } catch (error) {
    console.error('Error during logout:', error);
    showStatus('Error logging out', 'error');
  }
});

// Login form event listeners
document.getElementById('showSignup').addEventListener('click', (e) => {
  e.preventDefault();
  showSignupForm();
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearLoginMessages();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showLoginStatus('Please fill in all fields', 'error');
    return;
  }

  try {
    const { data, error } = await sendMessageWithRetry({ type: 'SIGN_IN_WITH_EMAIL', email, password });
    if (error) throw error;
    showLoginStatus('Sign in successful!');
    await checkAuthState();
  } catch (error) {
    showLoginStatus(error.message || 'Failed to sign in', 'error');
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearLoginMessages();

  const email = signupEmail.value.trim();
  const password = signupPassword.value;

  if (!email || !password) {
    showLoginStatus('Please fill in all fields', 'error');
    return;
  }

  try {
    const { data, error } = await sendMessageWithRetry({ type: 'SIGN_UP_WITH_EMAIL', email, password });
    if (error) throw error;
    showLoginStatus('Sign up successful! Please check your email for verification.');
    showLoginForm();
  } catch (error) {
    showLoginStatus(error.message || 'Failed to sign up', 'error');
  }
});

googleSignInBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  clearLoginMessages();

  try {
    const result = await sendMessageWithRetry({ type: 'GOOGLE_SIGN_IN' });
    
    if (result.error) throw result.error;
    showLoginStatus('Sign in successful!');
    await checkAuthState();
  } catch (error) {
    showLoginStatus(error.message || 'Failed to sign in with Google', 'error');
  }
});

// Start initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'LOAD_QA':
      console.log("Loading QA");
      if (request.question && request.answer) {
        questionText.value = request.question;
        answerText.value = request.answer;
      } else {
        console.error('Question or answer input elements not found');
      }
      break;

    case 'SHOW_STATUS':
      showStatus(request.message, request.statusType);
      break;

    case 'REAUTH_REQUIRED':
      // Handle re-authentication requirement
      console.log('Re-authentication required in sidepanel');
      showLoginStatus('Please sign in again to continue', 'error');
      showLoginState();
      showLoginForm();
      break;
  }
});
