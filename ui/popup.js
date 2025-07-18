// Auth handled via background.js message passing

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loggedInState = document.getElementById('loggedInState');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const googleSignInBtn = document.getElementById('googleSignIn');
const openSidePanelBtn = document.getElementById('openSidePanelBtn');

// Show/hide forms
function showLoginForm() {
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  loggedInState.style.display = 'none';
  clearMessages();
}

function showSignupForm() {
  loginForm.style.display = 'none';
  signupForm.style.display = 'block';
  loggedInState.style.display = 'none';
  clearMessages();
}

function showLoggedInState(user) {
  loginForm.style.display = 'none';
  signupForm.style.display = 'none';
  loggedInState.style.display = 'block';
  document.getElementById('userEmail').textContent = user.email;
  clearMessages();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
}

function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
}

function clearMessages() {
  errorMessage.style.display = 'none';
  successMessage.style.display = 'none';
}

// Event Listeners
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
  clearMessages();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  try {
    const { data, error } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SIGN_IN_WITH_EMAIL', email, password }, resolve);
    });
    if (error) throw error;
    showLoggedInState(data.user);
  } catch (error) {
    showError(error.message || 'Failed to sign in');
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = signupEmail.value.trim();
  const password = signupPassword.value;

  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  try {
    const { data, error } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SIGN_UP_WITH_EMAIL', email, password }, resolve);
    });
    if (error) throw error;
    showSuccess('Sign up successful! Please check your email for verification.');
    showLoginForm();
  } catch (error) {
    showError(error.message || 'Failed to sign up');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const { error } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, resolve);
    });
    if (error) throw error;
    showLoginForm();
  } catch (error) {
    showError(error.message || 'Failed to sign out');
  }
});

googleSignInBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  clearMessages();

  try {
    // Store the current state before starting OAuth
    const currentState = {
      isLoginForm: loginForm.style.display === 'block',
      isSignupForm: signupForm.style.display === 'block',
      isLoggedIn: loggedInState.style.display === 'block'
    };

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GOOGLE_SIGN_IN' }, (response) => {
        resolve(response);
      });
    });
    
    if (result.error) throw result.error;
    const window = await chrome.windows.getCurrent();

    showLoggedInState(result.data.user);

    await chrome.sidePanel.setOptions({
      path: 'ui/sidepanel.html',
      enabled: true
    });
    
    // Open the panel directly in response to the click
    await chrome.sidePanel.open({ windowId: window.id });
    
    openSidePanelBtn.textContent = 'Close Side Panel';
  } catch (error) {
    showError(error.message || 'Failed to sign in with Google');
  }
});

// Add this new event listener for the side panel button
openSidePanelBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      // Get current window
      const window = await chrome.windows.getCurrent();
      
      // Check if we're opening or closing
      const isOpening = openSidePanelBtn.textContent === 'Open Side Panel';
      
      if (isOpening) {
        // Set the options first
        await chrome.sidePanel.setOptions({
          path: 'ui/sidepanel.html',
          enabled: true
        });
        
        // Open the panel directly in response to the click
        await chrome.sidePanel.open({ windowId: window.id });
        
        openSidePanelBtn.textContent = 'Close Side Panel';

      } else {
        // Close the panel by disabling it
        await chrome.sidePanel.setOptions({
          enabled: false
        });
        openSidePanelBtn.textContent = 'Open Side Panel';
      }
    }
  } catch (error) {
    console.error('Error toggling side panel:', error);
  }
});

// Update the checkAuthState function to also check panel state
async function checkAuthState() {
  const { user, error } = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_USER' });

  console.log("Error in checkAuthState: ", error);
  if (user) {
    showLoggedInState(user);
    
    // Check initial panel state
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      // Initialize the side panel as closed by default
      await chrome.sidePanel.setOptions({
        enabled: false
      });
      openSidePanelBtn.textContent = 'Open Side Panel';
    }
  } else {
    console.log("Auth state exception: ", error);
    showLoginForm();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', checkAuthState); 