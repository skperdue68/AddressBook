import {publicPage} from './public-pages.js';
export function legalPage(path){
 const privacy=path==='/privacy',title=privacy?'Privacy Policy':'Terms of Use';
 const body=privacy?`
 <p>HearthBound helps people discover, register and share ESO houses and tours, on the web and through an optional Discord bot.</p>
 <h2>Information used by the service</h2>
 <p>Discord sign-in provides your account ID and profile information. Connected Discord server membership and roles are used to select a community and check access. HearthBound does not ask for your Discord password.</p>
 <p>Stored application data includes house registrations and ESO account names, tours and stop notes, uploaded images and captions, comments, favorites, tour progress, access requests, moderation records and feedback. Usage activity can include your display name, originating server, action and timestamp.</p>
 <h2>Who can see content</h2>
 <p>Active Global houses and tours can be viewed without signing in, within their ESO platform and region. Server content is limited to the relevant community. Private records remain creator-only in normal application views. An explicitly created Share Pass can provide additional viewing access; share those links carefully. Pending houses require administrative approval before normal browsing.</p>
 <p>Feedback and its internal review notes are restricted to the submitting account and bot owners as applicable. Authorized operators have technical access to stored data and backups to run and maintain the service. Application visibility controls do not encrypt records from the operator.</p>
 <h2>Cookies and external services</h2>
 <p>A signed session cookie keeps you signed in and remembers your selected workspace and access preview. A separate guest cookie remembers the selected platform and region. Signing out clears the session cookie. Discord handles its own sign-in service and may supply avatar images; opening external links is subject to those sites’ policies.</p>
 <h2>Corrections and removal</h2>
 <p>You can edit or remove records where your permissions allow. For other corrections, removal requests or privacy questions, contact a relevant server administrator or use Send feedback in HearthBound’s Support &amp; Access section. Historical activity, moderation records and backups can remain after an individual entry is changed or removed.</p>
 <p>Please avoid submitting secrets or personal information that you do not want included in the selected sharing scope.</p>`:`
 <p>HearthBound is a community tool for discovering and sharing ESO player housing. It is still in development, and features and interfaces can change.</p>
 <h2>Accounts and access</h2>
 <p>You can browse active Global content as a guest. A Discord account is required to register houses, create tours, favorite places or comment. Installing the Discord bot is optional for personal web use; Server sharing depends on a connected community. Administrative access must be configured or approved separately.</p>
 <h2>Content you submit</h2>
 <p>Submit accurate house links and information where possible. Upload only images and text you own or have permission to share, and credit creators when appropriate. Do not submit credentials, abusive content or material that violates others’ privacy or rights.</p>
 <p>Choose visibility carefully: Global entries are publicly browsable, Server entries belong to the selected community, and Private entries are for your own collection. Share Passes provide explicit additional viewing access. Administrators may review, correct, decline or remove shared content within their authorized scope.</p>
 <h2>Using house and tour information</h2>
 <p>ESO platform and region matter: a PC NA destination is not an Xbox or PC EU destination. House availability, in-game permissions and visitor limits can change. Check information in game when planning an event. HearthBound does not control access to an ESO house.</p>
 <h2>Service and support</h2>
 <p>Availability is not guaranteed. Keep your own copies of information that matters to you. Use Support &amp; Access to report issues or send feedback. HearthBound is a community project and does not claim to be an official ESO or Discord service.</p>`;
 return publicPage(title,`<article class="panel legal-page"><div class="eyebrow">HEARTHBOUND</div><h1>${title}</h1>${body}<p><a href="/">Back to HearthBound</a> · <a href="/app/support">Support &amp; Access</a></p></article>`);
}
