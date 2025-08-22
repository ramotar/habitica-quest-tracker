# Quest Tracker by Turac
The **Quest Tracker** automatically updates a [Google Sheet](https://www.google.com/sheets/about/) in the player's [Google Drive](https://drive.google.com/) whenever the player's [party](https://habitica.fandom.com/wiki/Party) completes a [quest](https://habitica.fandom.com/wiki/Quests).

The spreadsheet shows how many quest completions are needed by each party member for every quest in [Habitica](https://habitica.com/) in order to get all the rewards. It also shows total quest completion percentages for each party member and quest.
The spreadsheet can be shared with the player's party, so only one party member needs to run this automation (preferably the party leader).

**Preview of the Quest Tracker sheet:**
![Preview of the Quest Tracker sheet](/quest-tracker.png)

## Features
* shows quest completions per party member and quest
* calculates total completion percentages per quest and party member
* automatically updates on after each finished quest

## Template
This script is based on the [Habitica GAS Template](https://habitica.fandom.com/wiki/Habitica_GAS_Template).

## Installation
The source of this script is available on [Google Apps Script](https://script.google.com/home/projects/1IgMRExXuXIsGg2JF3Covsyab8N7eUJbI2X5cQ7F7pfESPs1kaom9QTNp) for the installation.
The installation instructions are given on the [Wiki page](https://habitica.fandom.com/wiki/Habitica_GAS_Template#Installation) of the template.

In addition, you only need to create a [Google Sheet](https://sheets.google.com/create) for your Quest Tracker. Give it a meaningful name like "Habitica: Quest Tracker" and copy the URL of the spreadsheet. During the installation, you need to put the spreadsheet URL into the configuration variable `SPREADSHEET_URL`.
If you've given a new name to the sheet where the Quest Tracker should print to (e.g. the name of your party), then you also need to put the new name into the configuration variable `SPREADSHEET_TAB_NAME`.

## Usage
Since the Quest Tracker works for all party members at once, it is sufficient for one party member (e.g. the party leader) to run the script. Simply share the spreadsheet with your party and everybody can see their current quest completion progress.
This is best done by clicking the "Share" button in the top right corner, changes "General access" to "Anyone with the link" and copying the link with "Copy link" button below. Now you can include the link in the description of your party.

## Acknowledgement
* This script is based on [Quest Tracker](https://habitica.fandom.com/wiki/Quest_Tracker) created by [bumbleshoot](https://habitica.com/profile/35c3fb6f-fb98-4bc3-b57a-ac01137d0847)
