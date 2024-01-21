/**
 * Quest Tracker v1.0.17 (beta) by @bumbleshoot
 *
 * See GitHub page for info & setup instructions:
 * https://github.com/bumbleshoot/quest-tracker
 */

const QUEST_TRACKER_SPREADSHEET_URL = "";
const QUEST_TRACKER_SPREADSHEET_TAB_NAME = "Sheet1";

/*************************************\
 *  DO NOT EDIT ANYTHING BELOW HERE  *
\*************************************/

let members;

/**
 * doPost(e)
 *
 * This function is called by webhooks.
 */
let webhook;
function doPost(e) {
  try {

    webhook = true;

    // create temporary trigger to update the quest tracker
    let triggerNeeded = true;
    for (let trigger of ScriptApp.getProjectTriggers()) {
      if (trigger.getHandlerFunction() === "processTrigger") {
        triggerNeeded = false;
        break;
      }
    }
    if (triggerNeeded) {
      ScriptApp.newTrigger("processTrigger")
        .timeBased()
        .after(1)
        .create();
    }

  } catch (e) {
    if (!e.stack.includes("Address unavailable")) {
      MailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        DriveApp.getFileById(ScriptApp.getScriptId()).getName() + " failed!",
        e.stack
      );
      console.error(e.stack);
      throw e;
    }
  }
}

/**
 * processTrigger()
 *
 * Deletes temporary triggers, calls the updateQuestTracker()
 * function, and emails the user if any errors are thrown.
 */
function processTrigger() {
  try {

    // delete temporary triggers
    for (let trigger of ScriptApp.getProjectTriggers()) {
      ScriptApp.deleteTrigger(trigger);
    }

    // update quest tracker
    updateQuestTracker();

  } catch (e) {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      DriveApp.getFileById(ScriptApp.getScriptId()).getName() + " failed!",
      e.stack
    );
    console.error(e.stack);
    throw e;
  }
}

/**
 * fetch(url, params)
 *
 * Wrapper for Google Apps Script's UrlFetchApp.fetch(url, params):
 * https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchurl,-params
 *
 * Retries failed API calls up to 2 times, retries for up to 1 min if
 * Habitica's servers are down, & handles Habitica's rate limiting.
 */
let rateLimitRemaining;
let rateLimitReset;
function fetch(url, params) {

  // try up to 3 times
  for (let i = 0; i < 3; i++) {

    // if rate limit reached
    if (rateLimitRemaining != null && Number(rateLimitRemaining) < 1) {

      // wait until rate limit reset
      let waitUntil = new Date(rateLimitReset);
      waitUntil.setSeconds(waitUntil.getSeconds() + 1);
      let now = new Date();
      Utilities.sleep(Math.max(waitUntil.getTime() - now.getTime(), 0));
    }

    // call API
    let response;
    while (true) {
      try {
        response = UrlFetchApp.fetch(url, params);
        break;
      }
      // if address unavailable, wait 5 seconds & try again
      catch (e) {
        if (!webhook && e.stack.includes("Address unavailable")) {
          Utilities.sleep(5000);
        } else {
          throw e;
        }
      }
    }

    // store rate limiting data
    rateLimitRemaining = response.getHeaders()["x-ratelimit-remaining"];
    rateLimitReset = response.getHeaders()["x-ratelimit-reset"];

    // if success, return response
    if (response.getResponseCode() < 300 || (response.getResponseCode() === 404 && (url === "https://habitica.com/api/v3/groups/party" || url.startsWith("https://habitica.com/api/v3/groups/party/members")))) {
      return response;
    }
    // if rate limited due to running multiple scripts, try again
    else if (response.getResponseCode() === 429) {
      i--;
    }
    // if 3xx or 4xx or failed 3 times, throw exception
    else if (response.getResponseCode() < 500 || i >= 2) {
      throw new Error("Request failed for https://habitica.com returned code " + response.getResponseCode() + ". Truncated server response: " + response.getContentText());
    }
  }
}

/**
 * getQuestData()
 *
 * Gathers relevant quest data from Habitica's API, arranges it
 * in a JavaScript Object, and returns the object.
 */
function getQuestData() {

  console.log("Getting quest data");

  // sort party members by username
  members.sort((a, b) => {
    return a.auth.local.username.localeCompare(b.auth.local.username);
  })

  // get # each egg & hatching potion owned/used for each member
  for (let member of members) {
    member.numEachEggOwnedUsed = member.items.eggs;
    member.numEachPotionOwnedUsed = member.items.hatchingPotions;
    for (let [pet, amount] of Object.entries(member.items.pets)) {
      if (amount > 0) { // 5 = newly hatched pet, >5 = fed pet, -1 = mount but no pet
        pet = pet.split("-");
        let species = pet[0];
        let color = pet[1];
        if (member.numEachEggOwnedUsed.hasOwnProperty(species)) {
          member.numEachEggOwnedUsed[species] = member.numEachEggOwnedUsed[species] + 1;
        } else {
          member.numEachEggOwnedUsed[species] = 1;
        }
        if (member.numEachPotionOwnedUsed.hasOwnProperty(color)) {
          member.numEachPotionOwnedUsed[color] = member.numEachPotionOwnedUsed[color] + 1;
        } else {
          member.numEachPotionOwnedUsed[color] = 1;
        }
      }
    }
    for (let mount of Object.keys(member.items.mounts)) {
      mount = mount.split("-");
      let species = mount[0];
      let color = mount[1];
      if (member.numEachEggOwnedUsed.hasOwnProperty(species)) {
        member.numEachEggOwnedUsed[species] = member.numEachEggOwnedUsed[species] + 1;
      } else {
        member.numEachEggOwnedUsed[species] = 1;
      }
      if (member.numEachPotionOwnedUsed.hasOwnProperty(color)) {
        member.numEachPotionOwnedUsed[color] = member.numEachPotionOwnedUsed[color] + 1;
      } else {
        member.numEachPotionOwnedUsed[color] = 1;
      }
    }
  }

  // get lists of premium eggs, premium hatching potions & wacky hatching potions
  let premiumEggs = [];
  for (let egg of Object.values(api_getContent().questEggs)) {
    premiumEggs.push(egg.key);
  }
  let premiumHatchingPotions = [];
  for (let potion of Object.values(api_getContent().premiumHatchingPotions)) {
    premiumHatchingPotions.push(potion.key);
  }
  let wackyHatchingPotions = [];
  for (let potion of Object.values(api_getContent().wackyHatchingPotions)) {
    wackyHatchingPotions.push(potion.key);
  }

  // create quest lists
  let eggQuests = [];
  let hatchingPotionQuests = [];
  let petQuests = [];
  let masterclasserQuests = [];
  let unlockableQuests = [];
  let achievementQuests = [];

  // for each quest
  for (let quest of Object.values(api_getContent().quests)) {

    // if world boss, skip it
    if (quest.category == "world") {
      continue;
    }

    // get rewards
    let rewards = [];
    if (typeof quest.drop.items !== "undefined") {

      for (let drop of quest.drop.items) {

        let rewardName = drop.text;
        let rewardType = "";

        if (drop.type == "eggs" && premiumEggs.includes(drop.key)) {
          rewardName = api_getContent().eggs[drop.key].text + " Egg";
          rewardType = "egg";
        } else if (drop.type == "hatchingPotions" && premiumHatchingPotions.includes(drop.key)) {
          rewardType = "hatchingPotion";
        } else if (drop.type == "hatchingPotions" && wackyHatchingPotions.includes(drop.key)) {
          rewardType = "wackyPotion";
        } else if (drop.type == "mounts") {
          rewardType = "mount";
        } else if (drop.type == "pets") {
          rewardType = "pet";
        } else if (drop.type == "gear") {
          rewardType = "gear";
        }

        if (rewardType != "") {
          let index = rewards.findIndex(reward => reward.name == rewardName);
          if (index == -1) {
            rewards.push({
              key: drop.key,
              name: rewardName,
              type: rewardType,
              qty: 1
            });
          } else {
            rewards[index].qty++;
          }
        }
      }
    }

    // get completions needed & completions (individual)
    let neededIndividual;
    let completedIndividual = {};
    if (rewards.length > 0 && rewards[0].type == "egg") {
      neededIndividual = 20 / rewards[0].qty;
      for (let member of members) {
        if (typeof member.numEachEggOwnedUsed[rewards[0].key] === "undefined") {
          member.numEachEggOwnedUsed[rewards[0].key] = 0;
        }
        let timesCompleted = Math.min(member.numEachEggOwnedUsed[rewards[0].key] / rewards[0].qty, neededIndividual);
        completedIndividual[member.auth.local.username] = Math.floor(Math.ceil(neededIndividual) * timesCompleted / neededIndividual);
      }
    } else if (rewards.length > 0 && (rewards[0].type == "hatchingPotion" || rewards[0].type == "wackyPotion")) {
      if (rewards[0].type == "hatchingPotion") {
        neededIndividual = 18 / rewards[0].qty;
      } else {
        neededIndividual = 9 / rewards[0].qty;
      }
      for (let member of members) {
        if (typeof member.numEachPotionOwnedUsed[rewards[0].key] === "undefined") {
          member.numEachPotionOwnedUsed[rewards[0].key] = 0;
        }
        let timesCompleted = Math.min(member.numEachPotionOwnedUsed[rewards[0].key] / rewards[0].qty, neededIndividual);
        completedIndividual[member.auth.local.username] = Math.floor(Math.ceil(neededIndividual) * timesCompleted / neededIndividual);
      }
    } else {
      neededIndividual = 1;
      for (let member of members) {
        let timesCompleted = 0;
        for (let [questKey, completions] of Object.entries(member.achievements.quests)) {
          if (questKey == quest.key) {
            timesCompleted = Math.min(completions, neededIndividual);
            break;
          }
        }
        completedIndividual[member.auth.local.username] = timesCompleted;
      }
    }
    neededIndividual = Math.ceil(neededIndividual);

    // create quest object
    let questInfo = {
      name: quest.text,
      rewards,
      neededIndividual,
      completedIndividual
    };

    // add quest to corresponding quest list
    let rewardType = rewards.length > 0 ? rewards[0].type : null;
    if (quest.group == "questGroupDilatoryDistress" || quest.group == "questGroupTaskwoodsTerror" || quest.group == "questGroupStoikalmCalamity" || quest.group == "questGroupMayhemMistiflying" || quest.group == "questGroupLostMasterclasser") {
      masterclasserQuests.push(questInfo);
    } else if (quest.text == "The Basi-List" || quest.text == "The Feral Dust Bunnies") {
      achievementQuests.push(questInfo);
    } else if (quest.category == "unlockable") {
      unlockableQuests.push(questInfo);
    } else if (rewardType == "egg") {
      eggQuests.push(questInfo);
    } else if (["hatchingPotion", "wackyPotion"].includes(rewardType)) {
      hatchingPotionQuests.push(questInfo);
    } else if (rewardType == "pet" || rewardType == "mount") {
      petQuests.push(questInfo);
    }
  }

  // compare each pair of egg quests
  for (let i = 0; i < eggQuests.length; i++) {
    for (let j = i + 1; j < eggQuests.length; j++) {

      // if rewards are the same
      if (eggQuests[i].rewards.map(x => JSON.stringify(x)).sort((a, b) => a.localeCompare(b)).join(",") === eggQuests[j].rewards.map(x => JSON.stringify(x)).sort((a, b) => a.localeCompare(b)).join(",")) {

        // combine quest data & save to quest list
        eggQuests.push({
          name: eggQuests[i].name + " OR " + eggQuests[j].name,
          rewards: eggQuests[i].rewards,
          neededIndividual: eggQuests[i].neededIndividual,
          completedIndividual: eggQuests[i].completedIndividual
        });

        // delete individual quests
        eggQuests.splice(j, 1);
        eggQuests.splice(i, 1);
        j = i;
      }
    }
  }

  // return quest lists
  return {
    eggQuests,
    hatchingPotionQuests,
    petQuests,
    masterclasserQuests,
    unlockableQuests,
    achievementQuests
  };
}

/**
 * updateQuestTracker()
 *
 * Updates the Quest Tracker spreadsheet, which shows how many
 * quest completions are needed by each party member for every
 * quest in Habitica. Also shows total quest completion
 * percentages for each party member and quest.
 *
 * Run this function on the questFinished webhook.
 */
function updateQuestTracker() {

  // open spreadsheet & sheet
  try {
    var spreadsheet = SpreadsheetApp.openById(QUEST_TRACKER_SPREADSHEET_URL.match(/[^\/]{44}/)[0]);
    var sheet = spreadsheet.getSheetByName(QUEST_TRACKER_SPREADSHEET_TAB_NAME);

    // if sheet doesn't exist, print error & exit
    if (sheet === null) {
      console.log("ERROR: QUEST_TRACKER_SPREADSHEET_TAB_NAME \"" + QUEST_TRACKER_SPREADSHEET_TAB_NAME + "\" doesn't exit.");
      return;
    }
  }
  // if spreadsheet doesn't exist, print error & exit
  catch (e) {
    if (e.stack.includes("Unexpected error while getting the method or property openById on object SpreadsheetApp")) {
      console.log("ERROR: QUEST_TRACKER_SPREADSHEET_URL not found: " + QUEST_TRACKER_SPREADSHEET_URL);
      return;
    } else {
      throw e;
    }
  }

  // if no party, party = user
  members = api_getPartyMembers();
  if (typeof members === "undefined") {
    members = [api_getUser()];
  }

  // get quest data
  let questData = getQuestData();

  // sort egg, hatching potion, & pet quests alphabetically by reward name
  questData.eggQuests.sort((a, b) => {
    return a.rewards[0].name.localeCompare(b.rewards[0].name);
  });
  questData.hatchingPotionQuests.sort((a, b) => {
    return a.rewards[0].name.localeCompare(b.rewards[0].name);
  });
  questData.petQuests.sort((a, b) => {
    return a.rewards[0].name.localeCompare(b.rewards[0].name);
  });

  // combine quests into one list
  let quests = questData.eggQuests.concat(questData.hatchingPotionQuests).concat(questData.petQuests).concat(questData.masterclasserQuests).concat(questData.unlockableQuests).concat(questData.achievementQuests);

  console.log("Updating Quest Tracker");

  // clear sheet
  let generatedContent = sheet.getRange(2, 1, 999, Math.max(sheet.getLastColumn(), 1));
  generatedContent.clearContent().setBackground(null).breakApart();

  // get list of usernames
  let usernames = Object.keys(quests[0].completedIndividual);

  // sort usernames alphabetically
  usernames.sort((a, b) => {
    return a.localeCompare(b);
  });

  // print headings (usernames and TOTAL)
  sheet.getRange(2, 3, 1, usernames.length + 1).setValues([["TOTAL"].concat(usernames)]).setHorizontalAlignment("center").setFontWeight("bold");

  // print categories
  let firstEmptyRow = 3;
  let color1 = "#ffffff";
  let color2 = "#ebf4ff";
  sheet.getRange(firstEmptyRow, 1, quests.length).setTextRotation(90).setVerticalAlignment("middle").setFontWeight("bold");
  sheet.getRange(firstEmptyRow, 1, questData.eggQuests.length, 2).setBackground(color1).offset(0, 0, questData.eggQuests.length, 1).merge().setValue("Eggs");
  firstEmptyRow += questData.eggQuests.length;
  sheet.getRange(firstEmptyRow, 1, questData.hatchingPotionQuests.length, 2).setBackground(color2).offset(0, 0, questData.hatchingPotionQuests.length, 1).merge().setValue("Hatching Potions");
  firstEmptyRow += questData.hatchingPotionQuests.length;
  sheet.getRange(firstEmptyRow, 1, questData.petQuests.length, 2).setBackground(color1).offset(0, 0, questData.petQuests.length, 1).merge().setValue("Pets");
  firstEmptyRow += questData.petQuests.length;
  sheet.getRange(firstEmptyRow, 1, questData.masterclasserQuests.length, 2).setBackground(color2).offset(0, 0, questData.masterclasserQuests.length, 1).merge().setValue("Masterclasser");
  firstEmptyRow += questData.masterclasserQuests.length;
  sheet.getRange(firstEmptyRow, 1, questData.unlockableQuests.length, 2).setBackground(color1).offset(0, 0, questData.unlockableQuests.length, 1).merge().setValue("Unlockable");
  firstEmptyRow += questData.unlockableQuests.length;
  sheet.getRange(firstEmptyRow, 1, questData.achievementQuests.length, 2).setBackground(color2).offset(0, 0, questData.achievementQuests.length, 1).merge().setValue("Other");

  // misc formatting
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);
  sheet.getRange(3, 2, sheet.getLastRow(), 1).setHorizontalAlignment("right").setFontWeight("bold");

  // create array for TOTAL row
  let totals = new Array(usernames.length).fill(0);

  // for each quest
  let sumUsersPercentComplete = 0;
  for (let i = 0; i < quests.length; i++) {

    // print quest reward or name
    let reward = quests[i].rewards[0];
    if (i < questData.eggQuests.length) {
      sheet.getRange(i + 3, 2).setValue(reward.name.substring(0, reward.name.length - 4));
    } else if (i < questData.eggQuests.length + questData.hatchingPotionQuests.length) {
      sheet.getRange(i + 3, 2).setValue(reward.name.substring(0, reward.name.length - 16));
    } else if (i < questData.eggQuests.length + questData.hatchingPotionQuests.length + questData.petQuests.length) {
      sheet.getRange(i + 3, 2).setValue(reward.name);
    } else {
      sheet.getRange(i + 3, 2).setValue(quests[i].name.split(":")[0].replace(/^The /, "").replace(", Part", ""));
    }

    // get completions for each member
    let completedIndividual = Object.entries(quests[i].completedIndividual);

    // sort completions by username
    completedIndividual.sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });

    // for each member
    let totalQuestCompletions = 0;
    let totalQuestCompletionsNeeded = 0;
    for (let j = 0; j < completedIndividual.length; j++) {

      // print completions/completions needed
      let numCompletions = completedIndividual[j][1];
      let completionsNeeded = quests[i].neededIndividual;
      let cell = sheet.getRange(i + 3, j + 4);
      cell.setValue(numCompletions + "/" + completionsNeeded).setHorizontalAlignment("center").setFontStyle("normal");
      if (numCompletions >= completionsNeeded) {
        cell.setBackground("#b6d7a8");
      } else if (numCompletions >= 1) {
        cell.setBackground("#ffe599");
      } else {
        cell.setBackground("#ea9999");
      }

      // add completions for TOTAL column
      totalQuestCompletions += numCompletions;
      totalQuestCompletionsNeeded += completionsNeeded;

      // add percentage to TOTAL row
      totals[j] += numCompletions / completionsNeeded;
      if (i == quests.length - 1) {
        let userPercentComplete = totals[j] / quests.length * 100;
        totals[j] = Math.floor(userPercentComplete) + "%";
        sumUsersPercentComplete += userPercentComplete;
      }
    }

    // print TOTAL column
    sheet.getRange(i + 3, 3).setValue(Math.floor(totalQuestCompletions / totalQuestCompletionsNeeded * 100) + "%").setHorizontalAlignment("center").setFontStyle("normal");
  }

  // print TOTAL row
  sheet.getRange(sheet.getLastRow() + 1, 2).setValue("TOTAL");
  sheet.getRange(sheet.getLastRow(), 3).setValue(Math.floor(sumUsersPercentComplete / usernames.length) + "%").setHorizontalAlignment("center").setFontStyle("normal");
  sheet.getRange(sheet.getLastRow(), 4, 1, totals.length).setValues([totals]).setHorizontalAlignment("center").setFontStyle("normal");

  // print last updated
  sheet.getRange(sheet.getLastRow() + 2, 3, 1, 1).setHorizontalAlignment("left").setFontStyle("italic").setValues([["Last updated: " + new Date().toUTCString()]]);
}