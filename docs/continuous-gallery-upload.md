# Continuous screenshot uploads

Dropping one screenshot or choosing a file now starts the upload immediately. A caption is optional and can be added or changed afterward. The Upload screenshot button remains available for retrying a failed upload and as a fallback without JavaScript.

The upload controls appear above the gallery. Successful uploads refresh the images, counter and cover in place, then clear the upload file/caption fields and enable the next upload. They do not navigate, reload the house page or change the URL hash. The uploader's viewport position is retained when a new cover changes the house header height.

Caption edits, reordering, cover selection and removal also refresh in place. Unsaved caption drafts on other images survive refreshes. A screenshot selected during a pending gallery action waits for that action to finish before uploading. At eight images the uploader explains the limit and rejects additional drops; removing an image enables uploading again without a reload. Failed uploads retain their file and optional caption for retry.

The first image remains the cover. Its explanation now sits beside the gallery heading, instead of adding an extra badge above the first image's caption. Caption areas have matching minimum height.

Existing permissions are unchanged: gallery controls require the house's edit permission, and every mutation rechecks live access on the server. A Server administrator can manage Server houses in that server, Global house editing follows Global permissions, and Private houses remain creator-only, including their captions and screenshots. This does not grant broader administrative powers.

No migration, dependency installation or Discord command update is required. Merge, pull the latest code on Linux, and restart HearthBound.

Validation covers repeated dropped/chosen uploads, a stationary uploader, optional/later caption edits, dirty caption preservation, files queued during caption saves, the eight-image limit and removal recovery, viewer use after refresh, failed-upload retry, HTTP/CSRF checks, and live Server/Global/Private edit permissions.
