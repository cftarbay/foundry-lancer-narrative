let baseDice = 1;

const me = game.user.character;
const fields = foundry.applications.fields;

const radioOptions = [
  { value: 1, label: 'Accuracy' },
  { value: -1, label: 'Difficulty' },
  { value: 0, label: 'None', selected: true }
];

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

const manualInput = fields.createNumberInput({ id: 'override', name: 'override', min: -5, max: 8, step: 1, value: 0 });
const manualField = fields.createFormGroup({ input: manualInput, label: 'Manual modifier' });

const backgrounds = makeRadioButtons(radioOptions, "Background effect:", "background");

let dropdowns = '';
if (skillList.length > 1) dropdowns += skillsField.outerHTML;
if (burdenList.length > 1) dropdowns += burdenField.outerHTML;
if (gearList.length > 1) dropdowns += gearField.outerHTML;

//TODO make position dropdown?

//TODO actually fill out dialog inner styles
//TODO this doesn't actually do anything
const styles = createStyleTag();
console.log(styles);

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: "Narrative Check" },
  position: { width: 400 },
  classes: ['narrative-dialog'],
  //help checkbox
  //!TODO fix formatting (put on same line)
  //foundry dialog is using flexbox display
  content:
    styles
    + dropdowns
    + `${helpCheckbox.outerHTML}`
    + backgrounds
    +
    //free modifier number input
    //!TODO currently displaying as text input without click steps
    `${manualField.outerHTML}`,
  buttons: [{
    action: "submit",
    label: "Confirm",
    default: true,
    callback: (event, button, dialog) => {
      // Create a FormData object from the button's parent form
      const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
      return formData; // This value is returned by the 'wait' promise
    }
  },
  {
    action: "cancel",
    label: "Cancel",
    default: false,
    callback: (event, button, dialog) => {
      return null; // This value is returned by the 'wait' promise
    }
  }
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

  let r;

  //cannot roll more than 6 dice
  if (baseDice > 6) baseDice = 6;

  //if less than one die base, roll at disadvantage
  if (baseDice < 1) r = new Roll(`2d6kl1`);
  else if (baseDice === 1) r = new Roll('1d6');
  else if (baseDice === 2) r = new Roll('2d6kh1');
  else r = new Roll(`${baseDice}d6kh1`);

  await r.evaluate();

  let msg = buildResultMsg(r, getDiceFromRoll(r), skillName);

  //todo generate message including skill used (or unskilled)
  //include roll formula and total
  //include twist if there
  //include all dice and highlight ones that are used
  const cm = await ChatMessage.create({
    user: game.user._id,
    content: msg
  });

  //let btn = document.getElementById("mystupidbutton")
 // console.log(btn);
  
 // btn?.addEventListener("click",(e)=>{ console.log('fuck')});
  //console.log(btn);
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
  let set = "<fieldset style='display: flex; flex-direction: column;'> <legend>" + name + "</legend>";
  //populate options
  for (let s of opts) {
    set += "<div style='display: flex; flex-direction: row;'>";
    set += "<input type='radio' id='" + s.label + "' name='" + group + "' value=" + s.value;
    //set = applyStyles(set, 'flex-direction: row;');
    if (s?.selected)
      set += " checked>";
    else set += ">";
    set += "<label for='" + s.label + "' ";
    //set = applyStyles(set, 'flex-direction: row;');

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
  if (dice[0] === 6) return "Complete Success";
  else if (dice[0] > 3) return "Partial Success";
  else return "Failure";
}

function findTwist(dice) {
  if (dice.length < 2) return false;
  else return dice[0] === dice[1];
}

function buildResultMsg(r, dice, skill) {
  let msg = skill + " Check <br/>";
  msg += r + "<br/>";
  msg += dice.join(', ') + '<br/>';
  msg += getSuccess(dice);
  if (findTwist(dice)) msg += ' with a twist!';
 //msg += '<br/><button type="button" id="mystupidbutton">button</button>';

  return msg;
}

function createStyleTag() {
  return `
<style>
#override { appearance: auto !important;
font-size: 60px; }
color: #ff0000 !important;
</style>
  `
}
