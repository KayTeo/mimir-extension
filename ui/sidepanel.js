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
  // Load datasets for the current user
  await loadDatasets();
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

    // Get datasets from background script
    chrome.runtime.sendMessage({
      type: 'GET_DATASET_NAMES_LIST'
    }, (response) => {
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
    });

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
        // Create new dataset via background script
        chrome.runtime.sendMessage({
          type: 'CREATE_DATASET',
          datasetName: datasetName.trim()
        }, (response) => {
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
        });
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
      showStatus('Please sign in again to continue', 'error');
      // Clear the UI
      userEmailElement.textContent = '';
      datasetSelect.innerHTML = '';
      break;
  }
});
