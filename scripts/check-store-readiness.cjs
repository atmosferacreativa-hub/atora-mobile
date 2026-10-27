/* Structural check by default; --release blocks on the publisher's open checklist. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const app = read('app.json').expo;
const pkg = read('package.json');
const profile = read('store/publication.json');
const errors = [], pending = [];
if (app.version !== pkg.version) errors.push('app.json y package.json declaran versiones distintas');
if (!app.android?.package || !app.ios?.bundleIdentifier) errors.push('Faltan identificadores de plataforma');
if (!profile.publisher.name || !profile.publisher.developedBy) errors.push('Falta el editor confirmado');
for (const url of [profile.privacy.url, profile.review.academyUrl]) {
 try { if(new URL(url).protocol !== 'https:') throw Error(); } catch { errors.push('URL pública inválida o sin HTTPS'); }
}
for(const key of ['legalName','country','supportEmail','privacyEmail']) {
 const value=profile.publisher[key];
 if(!value) pending.push(`publisher.${key}`);
 else if(key.endsWith('Email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`Correo inválido: ${key}`);
}
const forbidden = /password|contrase(?:ñ|n)a|secret|token|privateKey/i;
function walk(value, trail='') {
 for(const [key,item] of Object.entries(value)) {
  if(forbidden.test(key)) errors.push(`No almacenar secretos en publication.json: ${trail}${key}`);
  if(item && typeof item==='object') walk(item,trail+key+'.');
 }
}
walk(profile);
for(const [group,keys] of Object.entries({privacy:['publishedVerified','inAppLinkVerified'],review:['accountsVerified'],assets:['androidScreenshotsVerified','iosScreenshotsVerified','playFeatureGraphicVerified'],builds:['androidProductionVerified','iosProductionVerified']})) {
 for(const key of keys) if(profile[group]?.[key]!==true) pending.push(`${group}.${key}`);
}
console.log(JSON.stringify({version:app.version,publisher:`${profile.publisher.name}, un desarrollo de ${profile.publisher.developedBy}`,privacyUrl:profile.privacy.url,status:errors.length?'invalid':pending.length?'pending':'declared-ready',errors,pending,note:'Las marcas son declaraciones del titular; no verifican firmas, cuentas ni URLs remotas. No sustituye las comprobaciones de PUBLICACION-TIENDAS.md.'},null,2));
process.exitCode = errors.length || (process.argv.includes('--release') && pending.length) ? 1 : 0;
