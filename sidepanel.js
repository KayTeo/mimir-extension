// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateSidePanel') {
        updateContent(message.data);
    }
});

// Function to update the side panel content
function updateContent(data) {
    const contentDiv = document.getElementById('sidePanelContent');
    if (data) {
        contentDiv.innerHTML = `
            <div>
                <h3>${data.title || 'Information'}</h3>
                <p>${data.content || 'No content available'}</p>
            </div>
        `;
    }
}

// Initial content load
document.addEventListener('DOMContentLoaded', () => {
    // You can add initial content here
    updateContent({
        title: 'Welcome to Mimir',
        content: 'This is your side panel. You can display any information here.'
    });
}); 