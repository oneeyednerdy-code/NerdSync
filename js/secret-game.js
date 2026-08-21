'use strict';

const SECRET_GAME_STORAGE_PREFIX = 'nerdsync_ghost_signal_v3';
const SECRET_GAME_ENDINGS = Object.freeze({
  open_signal: {
    title: 'OPEN SIGNAL',
    text: 'You open every emergency frequency and broadcast the names of the people still alive beneath Ward Nine. Families flood the streets carrying lanterns and old photographs. Helix cannot erase a district while the entire city is saying its names aloud.'
  },
  golden_ghost: {
    title: 'GOLDEN GHOST',
    text: 'You leave the terminal and meet Vesper beneath the ruined station. Together, you guide the trapped families through maintenance tunnels before the floodgates open. At sunrise, the survivors are safe—and neither of you can ever return to your old lives.'
  },
  human_frequency: {
    title: 'HUMAN FREQUENCY',
    text: 'You send the manifest to every family Helix told to stop searching, then destroy the floodgate controls. The official record collapses beneath hundreds of personal testimonies. Ward Nine survives because ordinary people refuse to let one another disappear.'
  }
});

const SECRET_GAME_NODES = Object.freeze({
  boot: {
    location: 'LOW ORBIT DISTRICT // 02:17',
    text: [
      'Acid rain writes static across the windows of your rented terminal. A forbidden emergency frequency breaks through the city noise.',
      'The voice belongs to Vesper, a courier declared dead three years ago when Helix sealed Ward Nine after a chemical fire. She says 312 people are still alive below the district—and the floodgates will open before dawn.'
    ],
    choices: [
      { label:'Answer the hidden signal', next:'mirror', effect:'empathy' },
      { label:'Trace the carrier first', next:'trace', effect:'control' }
    ]
  },
  mirror: {
    location: 'MIRROR NODE // UNREGISTERED',
    text: [
      'The voice resolves into a damaged video feed. Vesper is exhausted and bleeding through one sleeve inside an abandoned transit relay.',
      'She holds up a paper manifest covered in names, ages, and handwritten messages for families aboveground. “They told the city we were gone,” she says. “We were only trapped.”'
    ],
    choices: [
      { label:'Ask who benefits from the erasure', next:'archive', effect:'empathy' },
      { label:'Demand the source records', next:'vault', effect:'control' }
    ]
  },
  trace: {
    location: 'CORPORATE TRACE // 41% LOCK',
    text: [
      'The carrier skips through abandoned radio towers and forgotten railway cables. Its source is a relay beneath Ward Nine, where a Helix recovery crew is closing on Vesper.',
      'Inside their pursuit channel, you hear the order clearly: open the floodgates, recover the manifest, and leave no witness who can contradict the official death count.'
    ],
    choices: [
      { label:'Cut the corporate trace', next:'archive', effect:'defiance' },
      { label:'Keep the trace and take the root key', next:'vault', effect:'control' }
    ]
  },
  archive: {
    location: 'WARD NINE ARCHIVE // SEALED',
    text: [
      'The sealed archive contains hospital lists, family photographs, and three years of messages that never reached the surface. Ward Nine has been surviving in the dark while the city mourned empty graves.',
      'Vesper has found one maintenance route out. You have minutes to release the records or guide the people below before the recovery crew reaches the relay.'
    ],
    choices: [
      { label:'Read the messages from the families', next:'junction', effect:'empathy' },
      { label:'Copy the sealed casualty records', next:'junction', effect:'defiance' }
    ]
  },
  vault: {
    location: 'FLOODGATE VAULT // CONTROL ACCESS',
    text: [
      'The control vault holds the floodgate schedule, maintenance maps, and the signatures of every official who approved the cover-up.',
      'Vesper braces the relay-room door from the other side. You can control what happens next, but every available route asks someone to risk everything.'
    ],
    choices: [
      { label:'Take control of the floodgates', next:'junction', effect:'control' },
      { label:'Lock the recovery crew outside', next:'junction', effect:'defiance' }
    ]
  },
  junction: {
    location: 'THE LAST JUNCTION // DECISION REQUIRED',
    text: [
      'Three routes remain. Every route saves something. Every route destroys something.',
      'The city waits beneath the neon. Vesper looks into the failing camera and asks the question that kept her alive: “What do we owe the people we were told to forget?”'
    ],
    choices: [
      { label:'Broadcast every name to the city', ending:'open_signal' },
      { label:'Go below and lead the survivors out', ending:'golden_ghost' },
      { label:'Send the manifest and destroy the floodgates', ending:'human_frequency' }
    ]
  }
});

const secretGameModal = document.getElementById('secret-game-modal');
const secretGamePanel = secretGameModal.querySelector('.secret-game-panel');
const secretGameClose = document.getElementById('secret-game-close');
const secretGameLocation = document.getElementById('secret-game-location');
const secretGameCopy = document.getElementById('secret-game-copy');
const secretGameChoices = document.getElementById('secret-game-choices');
const secretGameProgress = document.getElementById('secret-game-progress');
const secretGameRestart = document.getElementById('secret-game-restart');
const secretGameTrigger = document.getElementById('secret-game-trigger');
const secretGameReplay = document.getElementById('secret-game-replay');
let secretGameReturnFocus = null;
let secretGameNode = 'boot';
let secretGameEffects = [];

function secretGameStorageKey() {
  return `${SECRET_GAME_STORAGE_PREFIX}:${currentUser?.id || 'anonymous'}`;
}

function readSecretGameProgress() {
  if (!currentUser?.id) return { endings:[] };
  try {
    const stored = JSON.parse(localStorage.getItem(secretGameStorageKey()) || '{}');
    const endings = Array.isArray(stored.endings) ? stored.endings.filter(id => SECRET_GAME_ENDINGS[id]) : [];
    return { endings:[...new Set(endings)] };
  } catch (error) {
    return { endings:[] };
  }
}

function saveSecretGameProgress(progress) {
  if (!currentUser?.id) return;
  try { localStorage.setItem(secretGameStorageKey(), JSON.stringify(progress)); } catch (error) { /* Local reward remains optional. */ }
}

function hasSecretGameReward() {
  return readSecretGameProgress().endings.length > 0;
}

function updateSecretGameProgressText() {
  const count = readSecretGameProgress().endings.length;
  secretGameProgress.textContent = `${count}/3 ending${count === 1 ? '' : 's'} recovered`;
}

function renderSecretRewardProfile() {
  const card = document.getElementById('secret-reward-profile');
  if (!card || !currentUser?.id || !hasSecretGameReward()) {
    card?.classList.add('hidden');
    return;
  }
  const progress = readSecretGameProgress();
  const names = progress.endings.map(id => SECRET_GAME_ENDINGS[id].title);
  document.getElementById('secret-reward-avatar').src = safeHttpsUrl(currentUser.profile_image_url);
  document.getElementById('secret-reward-avatar').alt = `${currentUser.display_name}'s Twitch avatar`;
  document.getElementById('secret-reward-title').textContent = `${currentUser.display_name}'s Golden Match Signal`;
  document.getElementById('secret-reward-summary').textContent = `${progress.endings.length}/3 endings recovered · ${names.join(' · ')}`;
  card.classList.remove('hidden');
}

function renderSecretGameNode(nodeId) {
  const node = SECRET_GAME_NODES[nodeId];
  if (!node) return;
  secretGameNode = nodeId;
  secretGameLocation.textContent = node.location;
  secretGameCopy.replaceChildren(...node.text.map(line => {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    return paragraph;
  }));
  secretGameChoices.replaceChildren(...node.choices.map(choice => {
    const button = document.createElement('button');
    button.className = 'secret-game-choice';
    button.type = 'button';
    button.textContent = `> ${choice.label}`;
    button.addEventListener('click', () => {
      if (choice.effect) secretGameEffects.push(choice.effect);
      if (choice.ending) completeSecretGame(choice.ending);
      else renderSecretGameNode(choice.next);
    });
    return button;
  }));
  requestAnimationFrame(() => secretGameChoices.querySelector('button')?.focus());
}

function completeSecretGame(endingId) {
  const ending = SECRET_GAME_ENDINGS[endingId];
  const progress = readSecretGameProgress();
  if (!progress.endings.includes(endingId)) progress.endings.push(endingId);
  saveSecretGameProgress(progress);
  secretGameLocation.textContent = `ENDING ${progress.endings.length}/3 // ${ending.title}`;
  secretGameCopy.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = ending.title;
  const copy = document.createElement('p');
  copy.textContent = ending.text;
  const effectCounts = secretGameEffects.reduce((counts, effect) => ({ ...counts, [effect]:(counts[effect] || 0) + 1 }), {});
  const dominantEffect = Object.entries(effectCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'unknown';
  const traceLabels = { empathy:'EMPATHIC SIGNAL', defiance:'INSURGENT SIGNAL', control:'SOVEREIGN SIGNAL', unknown:'UNCLASSIFIED SIGNAL' };
  const runProfile = traceLabels[dominantEffect];
  const trace = document.createElement('p');
  trace.className = 'secret-game-trace';
  trace.textContent = `RUN PROFILE // ${runProfile}`;
  const reward = document.createElement('p');
  reward.className = 'secret-game-unlocked';
  reward.textContent = 'GOLDEN MATCH SIGNAL UNLOCKED';
  const directive = document.createElement('p');
  directive.className = 'secret-game-directive';
  directive.textContent = 'FINAL DIRECTIVE // Tell no one what you learned today. The signal remembers.';
  secretGameCopy.append(title, copy, trace, reward, directive);
  const replay = document.createElement('button');
  replay.className = 'secret-game-choice';
  replay.type = 'button';
  replay.textContent = progress.endings.length === 3 ? '> All endings recovered — run again' : '> Return to the beginning';
  replay.addEventListener('click', restartSecretGame);
  secretGameChoices.replaceChildren(replay);
  updateSecretGameProgressText();
  renderSecretRewardProfile();
  requestAnimationFrame(() => replay.focus());
}

function restartSecretGame() {
  secretGameEffects = [];
  renderSecretGameNode('boot');
  updateSecretGameProgressText();
}

function openSecretGame() {
  if (!currentUser?.id || !secretGameModal.classList.contains('hidden') || !streamModal.classList.contains('hidden')) return;
  secretGameReturnFocus = document.activeElement;
  secretGameModal.classList.remove('hidden');
  secretGameModal.setAttribute('aria-hidden', 'false');
  document.getElementById('main-content').inert = true;
  document.body.classList.add('modal-open');
  restartSecretGame();
  requestAnimationFrame(() => secretGamePanel.focus());
}

function closeSecretGame() {
  if (secretGameModal.classList.contains('hidden')) return;
  secretGameModal.classList.add('hidden');
  secretGameModal.setAttribute('aria-hidden', 'true');
  document.getElementById('main-content').inert = false;
  document.body.classList.remove('modal-open');
  secretGameReturnFocus?.focus?.();
}

secretGameTrigger.addEventListener('click', openSecretGame);

secretGameReplay.addEventListener('click', openSecretGame);
secretGameClose.addEventListener('click', closeSecretGame);
secretGameRestart.addEventListener('click', restartSecretGame);
secretGameModal.addEventListener('click', event => { if (event.target === secretGameModal) closeSecretGame(); });

document.addEventListener('keydown', event => {
  if (!secretGameModal.classList.contains('hidden')) {
    if (event.key === 'Escape') { event.preventDefault(); closeSecretGame(); return; }
    if (event.key === 'Tab') {
      const focusable = [...secretGamePanel.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
});
