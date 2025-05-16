// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create menu items directly in the context menu
  chrome.contextMenus.create({
    id: "option1",
    title: "Option 11",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "option2",
    title: "Option 2",
    contexts: ["all"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "option1":
      // Handle option 1 click
      console.log("Option 11 clicked");
      break;
    case "option2":
      // Handle option 2 click
      console.log("Option 2 clicked");
      break;
  }
});

// Handle keyboard commands
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