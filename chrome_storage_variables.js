// Chrome storage variables are persistent, but it is useful to initialize them especially on first install
export async function initalize_storage_variables() {
    
    const { supabaseSession, supabaseUser, selectedDataset, openaiKey, system_prompt, mode } =
    await chrome.storage.local.get(['supabaseSession', 'supabaseUser', 'selectedDataset', 'openaiKey', 'system_prompt', 'mode']);
    
    if( supabaseSession === undefined) ;
    if( supabaseUser === undefined) ;
    if( selectedDataset === undefined) ;
    if( openaiKey === undefined) ;
    if( system_prompt === undefined)
        await chrome.storage.local.set({ "system_prompt" :
    `
        Convert the following text into a clear **question** and **answer** pair:

        Text: "{input_text}"

        Guidelines:
        - The question should be self-contained and answerable from the text.
        - The answer should be concise but complete.
        - If the text lists items (like 1, 2, 3), include them in the answer.
    `
    });


    if( mode === undefined) await chrome.storage.local.set({ "mode" : "auto"});

}


