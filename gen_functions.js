

async function add_to_dataset(selected_question, selected_label, selected_dataset) {
  // Get user from storage first
  const { supabaseUser } = await chrome.storage.local.get(['supabaseUser']);
  if (!supabaseUser) {
    console.log("No user found in storage, trying to get from Supabase");
    const { user, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    console.log("user is", user);
  } else {
    console.log("user from storage is", supabaseUser);
  }
  
  // Create the data point
  const { data: dataPoint, error: dataPointError } = await supabase
    .from('data_points')
    .insert({
      user_id: supabaseUser?.id || user.id,
      content: selected_question.trim(),
      label: selected_label.trim()
    })
    .select()
    .single();

  if (dataPointError) throw dataPointError;

  // Create the association
  const { error: associationError } = await supabase
    .from('dataset_data_points')
    .insert({
      dataset_id: selectedDataset,
      data_point_id: dataPoint.id
    });

  if (associationError) throw associationError;
}

var addition_state = "question" //Varies between content and label on alternate clicks
var question = ""
var label = ""

export async function run_manual(info) {
  if (addition_state == "question") {
    question = info.selectionText;
    if (!question) {
      console.log("No question text selected");
      return;
    }
    addition_state = "label"
    updateContextMenuTitle(); // Update menu title after state change
  } else {
    label = info.selectionText;
    if (!label) {
      console.log("No label text selected");
      return;
    }

    if (!selectedDataset) {
      console.log("No dataset selected");
      return;
    }

    addition_state = "question"
    updateContextMenuTitle(); // Update menu title after state change
    var status = await add_to_dataset(question, label, selectedDataset)
    console.log("Status:", status);
  }

  console.log("Using dataset:", selectedDataset);
  console.log("Selected question:", question);
}

export async function run_auto(info) {
  // TODO: Implement auto mode
  console.log("Running auto");
}
