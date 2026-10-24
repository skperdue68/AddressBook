document.querySelectorAll('.account-menu').forEach(menu => {
  const trigger = menu.querySelector('summary');
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      trigger.focus();
      event.preventDefault();
    }
  });
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
  menu.querySelectorAll('.account-avatar img').forEach(img => {
    const fallback = () => { img.hidden = true; };
    img.addEventListener('error', fallback);
    if (img.complete && img.naturalWidth === 0) fallback();
  });
});
