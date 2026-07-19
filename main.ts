let baseDice = 0;
const fields = foundry.applications.fields;

//toggle the amount of informational text shown in chat messages
let verbose = true;
let twistVerbose = true;

let crit = false;
let twist = false;
let cut = 0;
let dieString = '';
let liveDice = 0;

//radio button options for background accuracy or penalty
const radioOptions = [
  { value: 1, label: 'Accuracy' },
  { value: -1, label: 'Difficulty' },
  { value: 0, label: 'None', selected: true }
];

//cut options to institute difficulty
const cutOptions = [
  { value: 0, label: 'Normal', selected: true },
  { value: 1, label: 'Difficult (Cut 1)' },
  { value: 2, label: 'Heroic (Cut 2)' }
];

//effect options to determine impact of roll
const effectOptions = [
  { value: 'Limited', label: 'Limited' },
  { value: 'Standard', label: 'Standard', selected: true },
  { value: 'Great', label: 'Great' }
];

//position options to determine possible consequences of roll
const positionOptions = [
  { value: "Controlled", label: 'Controlled' },
  { value: 'Risky', label: 'Risky', selected: true },
  { value: 'Desperate', label: 'Desperate' }
];

//for gm to choose visible or invisible roll type
const rollTypeOptions = [
  { value: 'private', label: 'Private', selected: true },
  { value: 'public', label: 'Public' }
];

//dialog submit button
const submitButton = {
  action: "submit",
  label: "Confirm",
  default: true,
  callback: (event, button, dialog) => {
    // Create a FormData object from the button's parent form
    const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
    return formData; // This value is returned by the 'wait' promise
  }
};

//dialog cancel button
const cancelButton = {
  action: "cancel",
  label: "Cancel",
  default: false,
  callback: (event, button, dialog) => {
    return null;
  }
};

const twistTxt = "Something unexpected, unusual, or unintended happens.";
const critTxt = "Your Effect is increased.";

const resultAliases = new Map();
resultAliases.set("Triumph", "Complete Success");
resultAliases.set("Conflict", "Partial Success");
resultAliases.set("Disaster", "Failure");

//todo this should be a 2d array but who cares
const resultControlledTable = new Map();
resultControlledTable.set("Triumph", "The action succeeds.");
resultControlledTable.set("Conflict", "The action succeeds, but incurs a minor consequence or stress, or reduces Effect.");
resultControlledTable.set("Disaster", "The action fails, and also incurs a minor consequence, stress, or introduces a minor narrative complication to the scene.");

const resultRiskyTable = new Map();
resultRiskyTable.set("Triumph", "The action succeeds, but may still introduce minor consequences or stress.");
resultRiskyTable.set("Conflict", "The action succeeds, but incurs a consequence, stress, reduces Effect, and/or introduces a narrative complication to the scene.");
resultRiskyTable.set("Disaster", "The action fails, and also incurs a consequence, stress, and/or introduces a narrative complication to the scene.");

const resultDesperateTable = new Map();
resultDesperateTable.set("Triumph", "The action succeeds, but may still introduce consequences or stress.");
resultDesperateTable.set("Conflict", "The action succeeds, but incurs a severe consequence, significant stress, reduces Effect, and/or introduces a major narrative complication to the scene.");
resultDesperateTable.set("Disaster", "The action fails, and also incurs a severe consequence, significant stress, and/or introduces a major narrative complication to the scene.");

const manualInput = fields.createNumberInput({ id: 'override', name: 'override', min: -5, max: 8, step: 1, value: 0 });
const manualField = fields.createFormGroup({ input: manualInput, label: 'Manual modifier' });

const cutButtons = makeRadioButtons(cutOptions, "Difficulty (Cut)", "cut");
const effectButtons = makeRadioButtons(effectOptions, "Effect", 'effect');
const positionButtons = makeRadioButtons(positionOptions, "Position", 'position');

//override dialog onrender to apply styles to dialog elements
class customDialog extends foundry.applications.api.DialogV2 {
  _onRender(options) {
    let narrativeChecks = document.getElementsByClassName('narrativeDialog');

    //let dialog scroll vertically if necessary
    if (narrativeChecks && narrativeChecks.length > 0) {
      let style = narrativeChecks[0].style;
      style['overflow-y'] = 'scroll';
    }

    //move help checkbox left instead of far right
    let checkBoxParent = document.getElementById("helpAction")?.parentElement;
    if (checkBoxParent)
      checkBoxParent.style['justify-content'] = "flex-start";

    //reduce width of override number input and put spinner arrows back
    //!TODO only works on some browsers (mine but not freds)
    let overrideInput = document.getElementById("override");
    if (overrideInput) {
      overrideInput.style['width'] = '5rem';
      overrideInput.style['appearance'] = 'auto';
      overrideInput.style['-moz-appearance'] = 'auto';
      overrideInput.style['flex'] = '0 0 auto';
      let overrideParent = overrideInput.parentElement;
      if (overrideParent)
        overrideParent.style['justify-content'] = "flex-start";
    }

    //register listeners to update the number of dice to be rolled when user changes a field value
    calcDiceLive();
    getFormValuesLive();
  }
}

let me;
const isGm = game.user.isActiveGM;
if (!isGm)
  await playerFlow();
else
  await gmFlow();

function calcDiceLive() {
  document.getElementById("helpAction")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("skills")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("burdens")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("gear")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("override")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("background-buttons")?.addEventListener("change", (e) => { getFormValuesLive(); });
  document.getElementById("cut-buttons")?.addEventListener("change", (e) => { getFormValuesLive(); });
}

function getFormValuesLive() {
  const beingHelped = document.getElementById("helpAction")?.checked ? 1 : 0;

  const skillValue = document.getElementById("skills")?.value ?? '|0';
  const skillNum = parseInt(skillValue.split('|')[1]);

  const burdenValue = parseInt(document.getElementById("burdens")?.value ?? '0');
  const gearValue = parseInt(document.getElementById("gear")?.value ?? '0');

  const overrideValue = parseInt(document.getElementById("override")?.value ?? '0');

  const selectedBackground = parseInt(document.querySelector('input[name="background"]:checked')?.value ?? '0');

  const selectedCut = parseInt(document.querySelector('input[name="cut"]:checked')?.value ?? '0');

  const diceRolling = beingHelped + skillNum + burdenValue + gearValue + overrideValue + selectedBackground;

  let diceString = diceRolling + "d6";
  if (diceRolling - selectedCut <= 0)
    diceString = '2d6 keep lowest';
  else if (selectedCut > 0)
    diceString += ' cut ' + selectedCut;

  let tooltipString = "";
  if (isGm)
    tooltipString += 'Manual Dice Pool: ' + overrideValue + '; ';
  else {
    tooltipString += 'Skill: ' + skillNum + '; ';
    if (burdenValue != 0)
      tooltipString += 'Burden: ' + burdenValue + '; ';
    if (gearValue > 0)
      tooltipString += 'Gear: ' + gearValue + '; ';
    if (beingHelped > 0)
      tooltipString += 'Help Provided: ' + beingHelped + '; ';
    if (selectedBackground != 0)
      tooltipString += 'Background Effect: ' + selectedBackground + '; ';
    if (overrideValue != 0)
      tooltipString += 'Manual Modifier: ' + overrideValue + '; ';
  }
  if (selectedCut != 0)
    tooltipString += 'Difficulty: Cut ' + selectedCut + '; ';

  document.getElementById("liveCalc").innerHTML = '<div style="border-radius: 0.5rem; border: 1px dashed papayawhip; padding:0.5rem; cursor:help;" title="' + tooltipString + '">Rolling ' + diceString + '</div>';
}


async function playerFlow() {
  const me = game.user.character;
  const skillList = getSkillsList(me);
  const skillsInput = fields.createSelectInput({ id: 'skills', name: 'skills', options: skillList });
  const skillsField = fields.createFormGroup({ input: skillsInput, label: 'Relevant skill?' });

  const burdenList = getBurdensList(me);
  const burdenInput = fields.createSelectInput({ id: 'burdens', name: 'burdens', options: burdenList });
  const burdenField = fields.createFormGroup({ input: burdenInput, label: 'Relevant burden?' });

  const gearList = getItemsList(me);
  const gearInput = fields.createSelectInput({ id: 'gear', name: 'gear', options: gearList });
  const gearField = fields.createFormGroup({ input: gearInput, label: 'Relevant pilot gear?' });

  const helpInput = fields.createCheckboxInput({ id: 'helpAction', name: 'helpAction' });
  const helpCheckbox = fields.createFormGroup({ input: helpInput, label: 'Help provided?' });

  const backgrounds = makeRadioButtons(radioOptions, "Background effect:", "background");

  let dropdowns = '';
  if (skillList.length > 1) dropdowns += skillsField.outerHTML;
  if (burdenList.length > 1) dropdowns += burdenField.outerHTML;
  if (gearList.length > 1) dropdowns += gearField.outerHTML;

  const result = await customDialog.wait({
    window: { title: "Narrative Check", resizable: true, contentClasses: ['narrativeDialog'] },
    position: { width: 460 },
    classes: ['narrative-dialog'],
    content:
      dropdowns
      + helpCheckbox.outerHTML
      + "<div style='font-size:0.8rem; color: yellow; font-weight: 600; margin-top: -10px;'>!! WARNING: providing help forces the helping character to take stress (on a Risky or Desperate roll) and exposes them to any consequences that result from this check !!</div>"
      + backgrounds
      + manualField.outerHTML
      + "<div style='font-size:0.8rem; color: palegreen; font-weight: 600; margin-top: -10px;'>## INFO: apply any additional accuracy or difficulty (from pushing the roll, character drive, situation, devil's bargain, etc) here ##</div>"
      + positionButtons
      //+ "<div style='font-size:0.8rem; color: pink; font-weight: 600; margin-top: -10px;'>## INFO: position determines the severity of potential consequences resulting from this check ##</div>"
      + cutButtons
      + effectButtons
      //+ "<div style='font-size:0.8rem; color: palegreen; font-weight: 600; margin-top: -10px;'>## INFO: cut is a more dramatic difficulty modifier which removes the provided number of highest results. Ask your GM if cut applies, especially if this is a desperate roll or there are relevant penalties ##</div>"
      + "<div style='font-size:0.8rem; color: pink; font-weight: 600; margin-top: -10px;'>%% REMINDER: you may push a roll by taking stress to add an accuracy. Situationally, you may also take a worse Position for increased Effect, or take stress to increase Effect %%</div>"
      + "<div id='liveCalc'></div>"
    , buttons: [,
      submitButton,
      cancelButton
    ]
  });
  if (!!result && result !== 'cancel') {
    const skillValue = parseInt(result.skills.split("|")[1]);
    const skillName = result.skills.split("|")[0];

    const addSkills = skillValue;
    const addGear = parseInt(result.gear ?? '0');
    const subBurdens = parseInt(result.burdens ?? '0');
    const manMod = parseInt(result.override ?? '0');
    const addBg = parseInt(result.background);

    baseDice += addSkills + addGear + subBurdens + manMod + addBg;
    if (result.helpAction) baseDice += 1;

    cut = parseInt(result.cut);
    const roll = await rollDice();

    let msg = buildResultMsg(roll, getDiceFromRoll(roll), result.position, result.effect, cut, baseDice, skillName);
    let messageParams = {
      user: game.user._id,
      content: msg,
      sound: '/sounds/dice.wav'
    }
    if (crit)
      //peent bday party
      messageParams['sound'] = '/audio/peent-party.mp3';
    else if (twist) messageParams['sound'] = '/audio/peent.mp3';
    //if user does not have audio installed, make sure to catch err and still roll without audio
    try {
      const cm = await ChatMessage.create(messageParams);
    }
    catch (e) {
      delete messageParams.sound;
      const cm = await ChatMessage.create(messageParams);
    }
  }
}

async function gmFlow() {
  const visibilityButtons = makeRadioButtons(rollTypeOptions, "Roll Visibility", 'visibility');

  const result = await customDialog.wait({
    window: { title: "Narrative Check", resizable: true, contentClasses: ['narrativeDialog'] },
    position: { width: 460 },
    classes: ['narrative-dialog'],
    content:
      manualField.outerHTML
      + positionButtons
      + cutButtons
      + effectButtons
      + visibilityButtons
      + "<div id='liveCalc'></div>"
    ,
    buttons: [,
      submitButton,
      cancelButton
    ]
  });
  if (!!result && result !== 'cancel') {
    //we want gm input to just be the number rolled
    baseDice = parseInt(result.override);
    cut = parseInt(result.cut);

    const roll = await rollDice();

    let msg = buildResultMsg(roll, getDiceFromRoll(roll), result.position, result.effect, cut, baseDice);

    const uid = game.user.id;

    let messageParams = {
      user: game.user._id,
      content: msg,
      sound: '/sounds/dice.wav'
    }
    if (result.visibility === 'private')
      messageParams['whisper'] = uid;

    const cm = await ChatMessage.create(
      messageParams
    );
  }
}

async function rollDice() {
  let r;

  //note: it is possible to twist on kl rolls
  //if dice - cut <= 0, 2d6kl1
  //if cut >= dice and dice/cut is not 0, no triumph allowed

  //cannot roll more than 6 dice
  if (baseDice > 6) baseDice = 6;

  if (baseDice < 1 || baseDice - cut <= 0) dieString = '2d6kl1';
  //if one die just roll
  else if (baseDice === 1) dieString = '1d6';
  //if cutting highest
  else if (cut > 0) dieString = `${baseDice}d6dh${cut}kh1`;
  else dieString = `${baseDice}d6kh1`;

  r = new Roll(dieString);

  await r.evaluate();
  return r;
}

function getSkillsList(me) {
  //first skill option is none
  let skills = [
    { label: "None", value: "Unskilled|0" }
  ];
  //populate list of character skills and their values
  for (let i of me.items._source) {
    if (i.type === "skill") {
      let rank = i.system.curr_rank;
      skills.push({
        label: i.name + ' (+' + rank + ')',
        value: i.name + "|" + rank
      });
    }
  }
  return skills;
}

function getBurdensList(me) {
  //first burden option is none
  let burdens = [
    { label: "None", value: 0 }
  ];
  //populate list of burdens
  for (let i of me.system?.bond_state?.burdens) {
    burdens.push({
      label: i.name + " (-1)",
      value: -1
    });
  }
  return burdens;
}

function getItemsList(me) {
  //first item option is none
  let items = [
    { label: "None", value: 0 }
  ];
  //populate list of pilot gear
  for (let i of me.items._source) {
    if (i.type === "pilot_gear" || i.type === "pilot_armor" || i.type === "pilot_weapon") {
      items.push({
        label: i.name + ' (+1)',
        value: 1
      });
    }
  }
  return items;
}

function makeRadioButtons(opts, name, group) {
  //open html fieldset
  let set = "<fieldset id='" + group + "-buttons' style='display: flex; flex-direction: row; padding: 0.5rem; margin:0'> <legend>" + name + "</legend>";
  //populate options
  for (let s of opts) {
    set += "<div style='display: flex; flex-direction: row; height: 20px;'>";
    set += "<input style='margin-top:-2px;' type='radio' id='" + s.label + "' name='" + group + "' value=" + s.value;
    if (s?.selected)
      set += " checked>";
    else set += ">";
    set += "<label for='" + s.label + "' ";
    set += ">" + s.label + "</label>";
    set += "</div>";
  }
  set += "</fieldset>";
  return set;
}

function getDiceFromRoll(r) {
  let dice = r.terms[0].results;
  dice.sort((a, b) => {
    if (a.active) return -1;
    if (b.active) return 1;
    else return b.result - a.result;
  });
  return dice.map(d => { return d.result });
}

function getSuccess(dice) {
  //can only triumph on 6 and more dice than cut or 0 dice or 0 cut
  if ((dice[0] === 6) && (baseDice > cut || (cut === 0 && baseDice === 0))) return "Triumph"; //complete success
  else if (dice[0] > 3) return "Conflict"; //partial success
  else return "Disaster"; //failure
}

function findTwist(dice, cut) {
  //only one die, no twist
  if (dice.length < 2) return false;
  //if no cut (or functionally no cut), compare highest 2 dice
  if (cut === 0 || dieString === '2d6kl1') return dice[0] === dice[1];
  //if cutting, skip over cut dice
  if ((cut + 1) < dice.length) return dice[0] === dice[cut + 1];
  //otherwise no twist
  return false;
}

function findCrit(die) {
  //if no twist, no crit
  if (!twist) return false;
  //if result is 6 and twist, crit
  if (die === 6) return true;
  //otherwise result is not 6, no crit
  return false;
}

function buildResultMsg(r, dice, pos, effect, cut, baseDice, skill = '') {
  twist = findTwist(dice, cut);
  const outcome = getSuccess(dice);
  crit = findCrit(dice[0]);

  let dieRoll = baseDice + 'd6';
  if (baseDice === 0 || baseDice - cut <= 0)
    dieRoll = '2d6 keep lowest';
  else {
    if (cut > 0)
      dieRoll += ' (cut ' + cut + ')';
    if (baseDice - cut > 1)
      dieRoll += ' keep highest';
  }

  let msg = "<h6 style='font-style: italic; font-size: 1.2rem '>" + pos + " " + skill + " Check </h6>";
  msg += "<div style='font-size:0.9rem; font-weight:bold'>On success: " + effect + " Effect </div>"
  msg += "<div style='border: 2px solid black; border-radius: 5px; padding: 8px;'>";
  msg += "<div style='font-size: 0.8rem; width: max-content; border-bottom: 1px solid black'> [ Rolled " + dieRoll + " ] </div>";

  msg += getDiceDisplay(dice, cut);

  msg += "<div style='font-weight: bold; font-size: 1.1rem; margin-top: 10px;'>" + outcome + " // " + resultAliases.get(outcome) + "</div>";
  if (twist) msg += "<div style='font-weight: bold; font-size: 1.05rem; color: maroon;'>!! with a twist !!</div>";
  if (crit) msg += "<div style='font-weight: bold; font-size: 1.00rem; color: maroon;'>+ increased Effect +</div>";

  if (verbose || (twistVerbose && twist)) msg += '<hr style="margin-top: 3px; margin-bottom: 3px;"/>';
  if (verbose) {
    let map = resultControlledTable;
    if (pos === 'Risky') map = resultRiskyTable;
    else if (pos === 'Desperate') map = resultDesperateTable;
    msg += "<div>" + map.get(outcome) + "</div>";
  }
  if (verbose && twistVerbose && twist) msg += "<br/>";
  if (twistVerbose && twist) msg += "<div>" + twistTxt + "</div>";
  if (twistVerbose && crit) msg += "<br/><div>" + critTxt + "</div>";
  msg += "</div>";

  return msg;
}

function getDiceDisplay(dice, cut) {
  let msg = '<div style="background-color:whitesmoke; padding: 6px; width: max-content; margin-top: 4px; margin-bottom: 3px; ">';
  for (let i = 0; i < dice.length; i++) {
    let color = 'gray';
    let deco = '';

    //if first die, it is result- blue
    if (i === 0) color = 'navy';
    //if cutting and we are on a cut-numbered die, gray and strike through
    else if (cut > 0 && i <= cut) //deco = ' text-decoration: line-through #e7d1b1 3px;';
      deco = ' background: linear-gradient(to left top, transparent 47%, currentColor 48%, currentColor 52%, transparent 53%);';
    //if not cutting and twist, make second (twist) die red
    else if (i === 1 && twist && cut === 0) color = 'maroon';
    //if cutting and twist, make die after cut (twist) red
    else if (twist && i === cut + 1) color = 'maroon';
    msg += "<span style='margin: 2px; padding: 0 7px 0 7px; font-weight: bold; font-size: 1.3rem; border: 2px solid " + color + "; color: " + color + "; line-height: 28px;" + deco + "'>";
    msg += dice[i];
    msg += "</span>";
  }
  msg += "</div>"
  return msg;
}
