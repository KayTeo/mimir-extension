// Chrome storage variables are persistent, but it is useful to initialize them especially on first install
export async function initalize_storage_variables() {
    
    const { supabaseSession, supabaseUser, selectedDataset, openaiKey, system_prompt, mode } =
    await chrome.storage.local.get(['supabaseSession', 'supabaseUser', 'selectedDataset', 'openaiKey', 'system_prompt', 'mode']);
    
    if( supabaseSession === undefined) ;
    if( supabaseUser === undefined) ;
    if( selectedDataset === undefined) ;
    if( openaiKey === undefined) ;
    if( system_prompt === undefined)
        await chrome.storage.local.set({ "system_prompt" : "You are a helpful assistant that can answer questions about the text you are given. You are given a text and you need to answer the question based on the text."});
    if( mode === undefined) ;

}


