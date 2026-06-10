let baseDice = 1;
const fields = foundry.applications.fields;
let verbose = true;
let twistVerbose = true;

const radioOptions = [
  { value: 1, label: 'Accuracy' },
  { value: -1, label: 'Difficulty' },
  { value: 0, label: 'None', selected: true }
];

const positionOptions = [
  { value: "Controlled", label: 'Controlled' },
  { value: 'Risky', label: 'Risky', selected: true },
  { value: 'Desperate', label: 'Desperate' }
];

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

const cancelButton = {
  action: "cancel",
  label: "Cancel",
  default: false,
  callback: (event, button, dialog) => {
    return null; // This value is returned by the 'wait' promise
  }
};

const twistTxt = "Something unexpected, unusual, or unintended happens."

const resultAliases = new Map();
resultAliases.set("Triumph", "Complete Success");
resultAliases.set("Conflict", "Partial Success");
resultAliases.set("Disaster", "Failure");

//todo this should be a 2d array but who cares
const resultControlledTable = new Map();
resultControlledTable.set("Triumph", "The action succeeds.");
resultControlledTable.set("Conflict", "The action succeeds, but incurs a minor consequence.");
resultControlledTable.set("Disaster", "The action fails, and also incurs a minor consequence or introduces a minor narrative complication to the scene.");

const resultRiskyTable = new Map();
resultRiskyTable.set("Triumph", "The action succeeds.");
resultRiskyTable.set("Conflict", "The action succeeds, but incurs a consequence or introduces a narrative complication to the scene.");
resultRiskyTable.set("Disaster", "The action fails, and also incurs a consequence or introduces a narrative complication to the scene.");

const resultDesperateTable = new Map();
resultDesperateTable.set("Triumph", "The action succeeds.");
resultDesperateTable.set("Conflict", "The action succeeds, but incurs a severe consequence or introduces a major narrative complication to the scene.");
resultDesperateTable.set("Disaster", "The action fails, and also incurs a severe consequence or introduces a major narrative complication to the scene.");

const positionInput = fields.createSelectInput({ id: 'position', name: 'position', options: positionOptions });
const positionField = fields.createFormGroup({ input: positionInput, label: 'Position' });

//todo this is not displaying with steps for number selection and is instead a plain text field
const manualInput = fields.createNumberInput({ id: 'override', name: 'override', min: -5, max: 8, step: 1, value: 0 });
const manualField = fields.createFormGroup({ input: manualInput, label: 'Manual modifier' });

const cutInput = fields.createNumberInput({ id: 'cut', name: 'cut', min: 0, max: 6, step: 1, value: 0 });
const cutField = fields.createFormGroup({ input: cutInput, label: 'Cut' });

//override dialog onrender to apply style to dialog contents allowing them to scroll if window is too small
class customDialog extends foundry.applications.api.DialogV2 {
  _onRender(options) {
    let narrativeChecks = document.getElementsByClassName('narrativeDialog');

    if (narrativeChecks && narrativeChecks.length > 0) {
      let style = narrativeChecks[0].style;
      style['overflow-y'] = 'scroll';
    }
  }
}

let me;
if (!game.user.isActiveGM)
  await playerFlow();
else
  await gmFlow();

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
      + "<div style='font-size:0.8rem; color: yellow; font-weight: 600; margin-top: -10px;'>!! WARNING: providing help exposes the helping character to any consequences that result from this check !!</div>"
      + backgrounds
      + manualField.outerHTML
      + "<div style='font-size:0.8rem; color: pink; font-weight: 600; margin-top: -10px;'>## INFO: apply any additional accuracy or difficulty (from pushing the roll, character drive, situation, etc) here ##</div>"
      + positionField.outerHTML
      + "<div style='font-size:0.8rem; color: pink; font-weight: 600; margin-top: -10px;'>## INFO: position determines the severity of potential consequences resulting from this check ##</div>"
      + cutField.outerHTML
      + "<div style='font-size:0.8rem; color: palegreen; font-weight: 600; margin-top: -10px;'>## INFO: cut is a more dramatic difficulty modifier which removes the provided number of highest results. Ask your GM if cut applies, especially if this is a desperate roll or there are relevant penalties ##</div>"
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
    const manMod = parseInt(result.override);
    const addBg = parseInt(result.background);

    baseDice += addSkills + addGear + subBurdens + manMod + addBg;

    if (result.helpAction) baseDice += 1;

    let cut = parseInt(result.cut);
    //even if cutting have to allow one die to be rolled
    if (cut >= baseDice) cut = baseDice - 1;

    const roll = await rollDice(cut);

    let msg = buildResultMsg(roll, getDiceFromRoll(roll), result.position, cut, baseDice, skillName);

    const cm = await ChatMessage.create({
      user: game.user._id,
      content: msg
    });
  }
}

async function gmFlow() {
  const result = await customDialog.wait({
    window: { title: "Narrative Check", resizable: true, contentClasses: ['narrativeDialog'] },
    position: { width: 460 },
    classes: ['narrative-dialog'],
    content:
      manualField.outerHTML
      + positionField.outerHTML
      + cutField.outerHTML
    ,
    buttons: [,
      submitButton,
      cancelButton
    ]
  });
  if (!!result && result !== 'cancel') {
    const manMod = parseInt(result.override);
    //we want gm input to just be the number rolled except in the case of 0
    if (manMod === 0) baseDice = 1;
    else baseDice = manMod;

    let cut = parseInt(result.cut);
    //even if cutting have to allow one die to be rolled
    if (cut >= baseDice) cut = baseDice - 1;

    const roll = await rollDice(cut);

    let msg = buildResultMsg(roll, getDiceFromRoll(roll), result.position, cut, baseDice);

    const uid = game.user.id;

    const cm = await ChatMessage.create({
      user: game.user._id,
      content: msg,
      whisper: uid
    });
  }
}

async function rollDice(cut) {
  let r;

  //cannot roll more than 6 dice
  if (baseDice > 6) baseDice = 6;

  let dieString = '';

  //if less than one die base, roll at disadvantage
  if (baseDice < 1) dieString = '2d6kl1';
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
  let set = "<fieldset style='display: flex; flex-direction: column; padding: 0.5rem'> <legend>" + name + "</legend>";
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

function applyStyles(str, styles) {
  return str += ' style="' + styles + '" ';
}

function addLabelFor(id, label) {
  return '<label for="' + id + '">' + label + '</label>';
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
  if (dice[0] === 6) return "Triumph"; //complete success
  else if (dice[0] > 3) return "Conflict"; //partial success
  else return "Disaster"; //failure
}

function findTwist(dice, cut) {
  //only one die, no twist
  if (dice.length < 2) return false;
  //if no cut, compare highest 2 dice
  if (cut === 0) return dice[0] === dice[1];
  //if cutting, skip over cut dice
  if ((cut + 1) < dice.length) return dice[0] === dice[cut + 1];
  //otherwise no twist
  return false;
}

function buildResultMsg(r, dice, pos, cut, baseDice, skill = '') {
  const twist = findTwist(dice, cut);
  const outcome = getSuccess(dice);

  let dieRoll = baseDice + 'd6';
  if (cut > 0)
    dieRoll += ' (cut highest ' + cut + ')';
  dieRoll += ' keep highest';

  let msg = "<h6 style='font-style: italic; font-size: 1.2rem '>" + pos + " " + skill + " Check </h6>";
  msg += "<div style='border: 2px solid black; border-radius: 5px; padding: 8px;'>";
  msg += "<div style='font-size: 0.8rem; width: max-content; border-bottom: 1px solid black'> [ Rolled " + dieRoll + " ] </div>";

  msg += getDiceDisplay(dice, twist, cut);

  msg += "<div style='font-weight: bold; font-size: 1.1rem; margin-top: 10px;'>" + outcome + " // " + resultAliases.get(outcome) + "</div>";
  if (twist) msg += "<div style='font-weight: bold; font-size: 1.05rem; color: maroon;'>!! with a twist !!</div>";

  if (verbose || (twistVerbose && twist)) msg += '<hr style="margin-top: 3px; margin-bottom: 3px;"/>';
  if (verbose) {
    let map = resultControlledTable;
    if (pos === 'Risky') map = resultRiskyTable;
    else if (pos === 'Desperate') map = resultDesperateTable;
    msg += "<div>" + map.get(outcome) + "</div>";
  }
  if (verbose && twistVerbose && twist) msg += "<br/>";
  if (twistVerbose && twist) msg += "<div>" + twistTxt + "</div>";
  msg += "</div>";

  return msg;
}

function getDiceDisplay(dice, twist, cut) {
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
