let baseDice = 1;

const me = game.user.character;
const fields = foundry.applications.fields;

const radioOptions = [
  { value: 1, label: 'accuracy' },
  { value: -1, label: 'difficulty' },
  { value: 0, label: 'none', selected: true }
]

console.log("items");
console.log(me.items._source);

//skills
const skills = addLabelFor('skills', 'Relevant skill?') + makeHtmlSelect(getSkillsList(me), 'skills');
//burdens
const burdens = addLabelFor('burdens', 'Relevant burden?') + makeHtmlSelect(getBurdensList(me), 'burdens');
//gear
const gear = addLabelFor('gear', 'Relevant pilot gear?') + makeHtmlSelect(getItemsList(me), 'gear');

//help checkbox
const helpInput = fields.createCheckboxInput({ id: 'helpAction', name: 'helpAction' });
const helpCheckbox = fields.createFormGroup({ input: helpInput, label: 'Help provided?' });

//manual override
const manualInput = fields.createNumberInput({ id: 'override', name: 'override', min: -5, max: 8, step: 1, value: 0 });
const manualField = fields.createFormGroup({ input: manualInput, label: 'Manual modifier' });

//background radio buttons
const backgrounds = makeRadioButtons(radioOptions, "Background effect:", "background");

//!TODO radio buttons for background accuracy/difficulty/none


const result = await foundry.applications.api.DialogV2.wait({
  window: { title: "Narrative Check" },
  //help checkbox
  //!TODO fix formatting (put on same line)
  //foundry dialog is using flexbox display
  content:
    `${helpCheckbox.outerHTML}`
    + skills
    + burdens
    + gear
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
  }]
});

console.log(result);

const skillValue = parseInt(result.skills.split("|")[1]);
const skillName = result.skills.split("|")[0];

const addSkills = skillValue;
const addGear = parseInt(result.gear);
const subBurdens = parseInt(result.burdens);
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

console.log(r.dice)

console.log(r.terms);

await r.evaluate();

console.log(r.terms[0].results);

let dice = r.terms[0].results;

dice.sort((a, b) => {
  if (a.active) return -1;
  if (b.active) return 1;
  else return b.result - a.result;
});


let rolled = dice.map(d => { return d.result });
console.log(findTwist(rolled));

let msg = buildResultMsg(r, rolled, skillName);
console.log(msg)

console.log(rolled)

// The total resulting from the roll
console.log(r);

//todo generate message including skill used (or unskilled)
//include roll formula and total
//include twist if there
//include all dice and highlight ones that are used
ChatMessage.create({
  user: game.user._id,
  content: msg
});

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

//todo this is chopped. use foundry built ins?
function makeHtmlSelect(opts, name) {
  //open html select
  let select = "<select name='" + name + "' id='" + name + "'>";
  //populate options
  for (let s of opts)
    select += '<option value=' + s.value + '>' + s.label + '</option>';
  select += "</select>";
  return select;
}

function makeRadioButtons(opts, name, group) {
  //open html fieldset
  let set = "<fieldset>";
  set += "<legend>" + name + "</legend>"
  //populate options
  for (let s of opts)
    if (s?.selected) {
      set += "<input type='radio' id='" + s.label + "' name='" + group + "' value=" + s.value + " checked>"
      set += "<label for='" + s.label + "'>" + s.label + "</label>"
    }
    else {
      set += "<input type='radio' id='" + s.label + "' name='" + group + "' value=" + s.value + ">"
      set += "<label for='" + s.label + "'>" + s.label + "</label>"
    }
  set += "</fieldset>";
  return set;
}

function addLabelFor(id, label) {
  return '<label for="' + id + '">' + label + '</label>';
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


  return msg;
}
