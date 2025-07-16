// Chrome storage variables are persistent, but it is useful to initialize them especially on first install
export async function initalize_storage_variables() {
    
    const { supabaseSession, supabaseUser, selectedDataset, system_prompt, mode } =
    await chrome.storage.local.get(['supabaseSession', 'supabaseUser', 'selectedDataset', 'system_prompt', 'mode']);

    if(!system_prompt) {
        console.log("Initializing system prompt");
        await chrome.storage.local.set({ "system_prompt" :
    `
        Convert the following text into a single clear **question** and **answer** pair
        labled ###QUESTION### and ###ANSWER###:
        Guidelines:
        - The question should be self-contained and answerable from the text.
        - The answer should be concise but complete.
        - If the text lists items (like 1, 2, 3), include them in the answer.
    `
    });
    }

    if(!mode) {
        await chrome.storage.local.set({ "mode" : "auto"});
    }

}


