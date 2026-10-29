import {publicPage} from './public-pages.js';
import {linkButton} from './workspace-render.js';

export function loginRecoveryPage(kind,returnTo='/app'){
 // returnTo comes only from the validated, consumed OAuth state; still restrict
 // it here so this renderer cannot accidentally become an open redirect later.
 const safe=/^\/(app|admin)(\/|\?|$)/.test(String(returnTo))&&!/[\\\x00-\x20]/.test(returnTo)?returnTo:'/app';
 const path=new URL(safe,'https://hearthbound.invalid').pathname,entry=/^\/app\/(houses|tours)\/(\d+)(?:\/play)?$/.exec(path),browse=entry?`/browse/${entry[1]}/${entry[2]}`:'/browse';
 const title=kind==='cancelled'?'Sign-in cancelled':kind==='expired'?'Sign-in link unavailable':'Sign-in could not finish';
 const text=kind==='cancelled'?'You chose not to sign in. You can keep exploring Global houses and tours as a guest.':kind==='expired'?'This sign-in link has expired or was already used. Start a fresh sign-in, or continue browsing as a guest.':'Discord sign-in is temporarily unavailable. Your existing HearthBound records are unchanged. Try signing in again, or continue browsing as a guest.';
 const retry='/auth/discord?'+new URLSearchParams({returnTo:safe});
 return publicPage(title,`<section class="panel"><div class="eyebrow">HEARTHBOUND ACCOUNT</div><h1>${title}</h1><p>${text}</p><div class="actions">${linkButton('Try signing in again',retry,'primary')}${linkButton('Continue browsing',browse)}${linkButton('Home','/')}</div></section>`,{signInHref:retry});
}
