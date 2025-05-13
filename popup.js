import { signInWithEmail, signUpWithEmail, signOut, getCurrentUser, signInWithGoogle } from './auth.js';

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
    const { data, error } = await signInWithEmail(email, password);
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
    const { data, error } = await signUpWithEmail(email, password);
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
    const { error } = await signOut();
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
    const { data, error } = await signInWithGoogle();
    if (error) throw error;
    showLoggedInState(data.user);
  } catch (error) {
    showError(error.message || 'Failed to sign in with Google');
  }
});

// Check initial auth state
async function checkAuthState() {
  try {
    const { user, error } = await getCurrentUser();
    if (error) throw error;
    if (user) {
      showLoggedInState(user);
    } else {
      showLoginForm();
    }
  } catch (error) {
    console.error('Auth state check error:', error);
    showLoginForm();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', checkAuthState); 