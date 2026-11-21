/**
 * Gestion du coffre chiffré depuis l'ordinateur.
 *   npm run vault -- add chemin/vers/morceau.gp autre.musicxml
 *   npm run vault -- list
 *   npm run vault -- remove <id>
 * Le mot de passe est demandé au clavier (ou lu dans VAULT_PASSWORD). Il n'est jamais écrit sur disque.
 * Fichiers produits : public/vault/vault.json et public/vault/<id>.bin, à committer.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { addToVault, createVault, removeFromVault, unlockVault, type VaultEntry, type VaultFile } from '../src/vault/crypto';

const DIR = join(import.meta.dirname, '..', 'public', 'vault');
const VAULT = join(DIR, 'vault.json');

function ask(question: string): Promise<string> {
  if (process.env.VAULT_PASSWORD) return Promise.resolve(process.env.VAULT_PASSWORD);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Masque la saisie.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || !['add', 'list', 'remove'].includes(cmd)) {
    console.log('Usage : npm run vault -- add <fichiers…> | list | remove <id>');
    process.exit(1);
  }
  mkdirSync(DIR, { recursive: true });

  let vault: VaultFile;
  let key: CryptoKey;
  let entries: VaultEntry[];
  if (!existsSync(VAULT)) {
    if (cmd !== 'add') throw new Error('Pas encore de coffre : commence par « add ».');
    const pw = await ask('Nouveau mot de passe du coffre (12 caractères min.) : ');
    if (pw.length < 12) throw new Error('Mot de passe trop court (12 caractères minimum).');
    if (!process.env.VAULT_PASSWORD && (await ask('Confirme le mot de passe : ')) !== pw) throw new Error('Les mots de passe ne correspondent pas.');
    ({ vault, key } = await createVault(pw));
    entries = [];
  } else {
    vault = JSON.parse(readFileSync(VAULT, 'utf8'));
    ({ key, entries } = await unlockVault(vault, await ask('Mot de passe du coffre : ')));
  }

  if (cmd === 'list') {
    for (const e of entries) console.log(`${e.id}  ${e.name}  (${e.fileName}, ${Math.round(e.size / 1024)} Ko)`);
    console.log(`${entries.length} morceau(x).`);
    return;
  }
  if (cmd === 'remove') {
    const id = args[0];
    if (!entries.some((e) => e.id === id)) throw new Error(`Id inconnu : ${id}`);
    ({ vault, entries } = await removeFromVault(vault, key, entries, id));
    writeFileSync(VAULT, JSON.stringify(vault, null, 2));
    if (existsSync(join(DIR, `${id}.bin`))) unlinkSync(join(DIR, `${id}.bin`));
    console.log(`Retiré. ${entries.length} morceau(x) dans le coffre.`);
    return;
  }
  const files = args.map((p) => ({ fileName: basename(p), data: new Uint8Array(readFileSync(p)) }));
  if (!files.length) throw new Error('Aucun fichier indiqué.');
  const res = await addToVault(vault, key, entries, files);
  for (const b of res.blobs) writeFileSync(join(DIR, b.path), b.data);
  writeFileSync(VAULT, JSON.stringify(res.vault, null, 2));
  console.log(`${files.length} ajouté(s). ${res.entries.length} morceau(x) dans le coffre. Committe public/vault/.`);
}

main().catch((e) => {
  console.error(`Erreur : ${e.message}`);
  process.exit(1);
});
