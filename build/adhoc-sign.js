// Ad-hoc підпис .app (без сертифіката Apple), щоб програма запускалась на Apple Silicon.
// Зовнішній підпис отримує сталу «designated requirement» за ідентифікатором,
// тож дозволи macOS (Календар, Універсальний доступ) не злітають після кожного перезбирання.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const id = context.packager.appInfo.id;
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', [
    '--force', '--sign', '-', '--identifier', id,
    `-r=designated => identifier "${id}"`, app,
  ], { stdio: 'inherit' });
};
