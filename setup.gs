/**
 * Quest Tracker v1.0.0 by John Doe
 *
 * a port of Quest Tracker by bumbleshoot
 *
 * See Wiki page for info & setup instructions:
 * https://habitica.fandom.com/wiki/Habitica_GAS_Template
 */

/* ========================================== */
/* [Users] Required script data to fill in    */
/* ========================================== */
const USER_ID = "PasteYourUserIdHere";
const API_TOKEN = "PasteYourApiTokenHere";
// IMPORTANT: Do not share your API token with anyone!

/* ========================================== */
/* [Users] Required customizations to fill in */
/* ========================================== */
// [Authors] Place all mandatory user-modified variables here
// - e.g. skill to use, number of times to use, task to use skill on, etc.
const SPREADSHEET_URL = "PasteYourUrlHere";
const SPREADSHEET_TAB_NAME = "Sheet1";

/* ========================================== */
/* [Users] Optional customizations to fill in */
/* ========================================== */
// [Authors] Place all optional user-modified variables here
// - e.g. enable/disable notifications, enable/disable script features, etc.

/* ========================================== */
/* [Users] Do not edit code below this line   */
/* ========================================== */

// [Authors] Place your user ID and script name here
// - This is used for the "X-Client" HTTP header
// - See https://habitica.fandom.com/wiki/Guidance_for_Comrades#X-Client_Header
const AUTHOR_ID = "b477462a-5bb5-4040-9505-f0b049b4f0bb";
const SCRIPT_NAME = "QuestTracker";

// [Authors] Add global variables here
// - Note that these do not persist in between script calls
// - If you want to save values between calls, use PropertiesService
// - See https://developers.google.com/apps-script/reference/properties/properties-service
const scriptProperties = PropertiesService.getScriptProperties();

/* =================================== */
/* [Authors] Below you find functions, */
/*   that are only used once during    */
/*   installation, update or removal   */
/* =================================== */

function install() {
  // [Authors] These are one-time initial setup instructions that we'll ask
  //   the user to manually execute only once, during initial script setup
  // - Add triggers and webhooks for your script to service the events you care about
  // - Feel free to do all other one-time setup actions here as well
  //   e.g. creating tasks, reward buttons, etc.

  // check, if setup was already executed
  if (!getInstallTime()) {

    // if all options entered by the user are valid
    if (validateOptions()) {
      // create triggers
      createTriggers();
      // create webhooks
      createWebhooks();

      // save the time the installation was completed
      updateInstallTime();

      logInfo("Installation of the script succesfully finished!");
    }
  }
  else {
    logError("Installation of the script was already executed before")
  }
}

function uninstall() {
  // [Authors] These are one-time instructions that we'll tell the user to
  //   execute during script removal
  // - Add deleteWebhooks() here, if you created a webhook during initial setup
  // - Remove all other permanent changes the script has introduced during initial
  //   setup and normal use

  // delete triggers
  deleteTriggers();
  // delete webhooks
  deleteWebhooks();

  // remove the install time
  deleteInstallTime();

  logInfo("Removal of the script succesfully finished!");
}

function update() {
  // [Authors] This function updates the script after the user changed settings.
  // - It simply uninstalls and installs again.
  uninstall();
  install();
}

function createTriggers() {
  // [Authors] This function is used to create your necessary triggers
  // - Below you find an example trigger, that recurs every hour
  // - Feel free to modify this trigger or add additional triggers
}

function createWebhooks() {
  // [Authors] This function is used to create webhooks to your script
  // - Below you find an example webhook, that gets called, when a task is scored
  // - Feel free to modify this webhook or add additional webhooks

  logInfo("Creating webhooks");

  let webhookData = {
    "type": "questActivity",
    "options": {
      "questFinished": true
    }
  }
  api_createWebhook(webhookData);
}

function deleteTriggers() {
  // [Authors] This function deletes all existing triggers for your script

  let triggers = ScriptApp.getProjectTriggers();
  if (triggers.length > 0) {

    logInfo("Deleting triggers");

    for (let trigger of triggers) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function deleteWebhooks() {
  // [Authors] This function deletes all existing webhooks to your script

  let webhooks = api_getWebhooks();

  if (webhooks.length > 0) {

    logInfo("Deleting webhooks");

    let webAppURL = getWebAppURL();

    for (let webhook of webhooks) {
      if (webhook.url == webAppURL) {
        api_deleteWebhook(webhook.id);
      }
    }
  }
}

function validateOptions() {
  // [Authors] This function is used to validate the options entered by the user
  // - Validation of the predefined script data is already programmed
  // - Usually check for the right type and value

  let valid = true;

  if (typeof INT_USER_ID !== "string" || !TOKEN_REGEXP.test(INT_USER_ID)) {
    logError("USER_ID must equal your Habitica User ID.\n\ne.g. const USER_ID = \"12345678-90ab-416b-cdef-1234567890ab\";\n\nYour Habitica User ID can be found at https://habitica.com/user/settings/api");
    valid = false;
  }

  if (typeof INT_API_TOKEN !== "string" || !TOKEN_REGEXP.test(INT_API_TOKEN)) {
    logError("API_TOKEN must equal your Habitica API Token.\n\ne.g. const API_TOKEN = \"2345678-90ab-416b-cdef-1234567890ab\";\n\nYour Habitica API Token can be found at https://habitica.com/user/settings/api");
    valid = false;
  }

  // test credentials
  if (valid) {
    valid = testCredentials();

    if (api_getParty().leader.id !== INT_USER_ID) {
      logWarning("Quest Tracker should only be run by one party member (preferably the party leader).");
    }
  }

  if (typeof SPREADSHEET_URL !== "string" || !SPREADSHEET_URL.startsWith("https://docs.google.com/spreadsheets/d/") || SPREADSHEET_URL.match(/[^\/]{44}/) === null) {
    logError("SPREADSHEET_URL must equal the URL of the Google Sheet that contains the Quest Tracker tab. You can copy this URL from your address bar while viewing the spreadsheet in a web browser.\n\neg. const SPREADSHEET_URL = \"https://docs.google.com/spreadsheets/d/1YbiVoNxP6q08KFPY01ARa3bNv8MDhBtRx41fBqPWN2o\";");
    valid = false;
  }
  else {
    try {
      var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_URL.match(/[^\/]{44}/)[0]);
    } catch (error) {
      if (error.stack.includes("Unexpected error while getting the method or property openById on object SpreadsheetApp")) {
        logError("SPREADSHEET_URL not found: " + SPREADSHEET_URL);
        valid = false;
      } else {
        throw e;
      }
    }
  }

  if (typeof SPREADSHEET_TAB_NAME !== "string" || SPREADSHEET_TAB_NAME == "") {
    logError("SPREADSHEET_TAB_NAME must equal the name of the Quest Tracker tab.\n\neg. const SPREADSHEET_TAB_NAME = \"Quest Tracker\";");
    valid = false;
  }
  else if (typeof spreadsheet !== "undefined" && spreadsheet.getSheetByName(SPREADSHEET_TAB_NAME) === null) {
    logError("SPREADSHEET_TAB_NAME \"" + SPREADSHEET_TAB_NAME + "\" doesn't exist.");
    valid = false;
  }

  if (!valid) {
    logInfo("Please fix the above errors, create a new version of the deployment, and click \"Install\" again.\nIf you aren't sure how to do this, see \"Updating options\" in the documentation for this script.");
  }

  return valid;
}

function testCredentials() {
  // [Authors] This function tests the user credentials

  try {
    api_getParty(true);
  }
  catch (error) {
    if (error.message.startsWith("Request failed") && error.cause.getResponseCode() == 401) {
      logError("Your USER_ID and/or API_TOKEN is incorrect. Both of these can be found at https://habitica.com/user/settings/api");
      return false;
    }
    else {
      throw error;
    }
  }

  return true;
}
