// Listen for text selection changes
document.addEventListener('selectionchange', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    // Send the selected text to the background script
    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText
    });
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTED_TEXT') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
}); 