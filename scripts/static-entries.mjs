import {mkdirSync,copyFileSync} from 'node:fs';
// Static API uploads may not apply vercel.json rewrites. Both entry URLs must exist.
for(const entry of ['admin','wychowawca']){
  mkdirSync(`dist/${entry}`,{recursive:true});
  copyFileSync('dist/index.html',`dist/${entry}/index.html`);
}
