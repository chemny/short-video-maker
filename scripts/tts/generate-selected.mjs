import fs from 'node:fs';
import {prepareNarration} from './aligned.mjs';
import {generateCloudAligned} from './cloud-aligned.mjs';
import {hasCommand} from './media.mjs';

// Only synthesis failures permit failover. Text validation and alignment rejection stay blocking.
export const generateSelected = async ({planPath, selection, providers, options = {}, skillRoot,
  systemAvailable = () => process.platform === 'darwin' && hasCommand('say'),
  generate = async (name, settings) => providers[name].generateAligned
    ? providers[name].generateAligned({planPath, options: settings})
    : generateCloudAligned({planPath, options: settings, provider: providers[name], skillRoot}),
  warn = (message) => console.warn(message),
}) => {
  prepareNarration(JSON.parse(fs.readFileSync(planPath)));
  const automatic = selection.source === 'auto';
  const routes = [selection.provider];
  if (automatic) {
    if (selection.provider === 'voxcpm2') routes.push('edge');
    if (systemAvailable()) routes.push('local');
  }
  const attempts = [];
  for (const name of routes) {
    // Provider-specific voice IDs, rates and models must not leak to another backend.
    const settings = name === selection.provider ? options : {
      asrModel: options.asrModel, transcript: options.transcript, forceAsr: options.forceAsr,
    };
    let result;
    try {result = await generate(name, settings);}
    catch (error) {
      if (!automatic || !error.ttsSynthesisFailed || name === routes.at(-1)) throw error;
      attempts.push({provider: name, status: 'synthesis-unavailable'});
      warn(`TTS ${name} synthesis unavailable; trying ${routes[routes.indexOf(name) + 1]}.`);
      continue;
    }
    attempts.push({provider: name, status: 'generated'});
    const plan = JSON.parse(fs.readFileSync(planPath));
    plan.audio = {...plan.audio, selectionMode: automatic ? 'auto' : selection.source,
      providerSelection: {requested: selection.provider, actual: name, attempts, fallback: name !== selection.provider}};
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    if (automatic && name === 'local') warn('Using macOS system speech fallback (installed system voice, matched to Chinese narration when needed).');
    return {provider: name, selection: plan.audio.providerSelection, ...result};
  }
};
