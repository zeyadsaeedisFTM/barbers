/**
 * ============================================================
 *  SITE CONTENT — the ONE file to edit for this website.
 * ============================================================
 * Everything here (shop name, tagline, logo, photos, barbers,
 * hours, address, contact info, social links) flows out to the
 * whole site automatically through GET /api/config, which the
 * client reads via client/src/hooks/useShopConfig.js.
 *
 * You do NOT need to touch any component/page to change branding
 * or content — just edit the values below and restart the server
 * (npm run dev / npm start in the server folder).
 *
 * Leave a field as an empty string '' or empty array [] to hide
 * that section on the site instead of showing broken content.
 * ============================================================
 */

module.exports = {
  // ---- Identity -----------------------------------------------------
  // SHOP_NAME / SHOP_LOGO_URL in server/.env still work as overrides
  // (handy for quick per-deployment changes) but you can just edit the
  // defaults here directly too.
  shopName: process.env.SHOP_NAME || 'The Classic Cut',
  tagline: 'Sharp fades. No wait. Walk out looking right.',

  // Leave logoUrl empty ('') to use the built-in barber-pole icon mark
  // instead of an uploaded image.
  logoUrl: process.env.SHOP_LOGO_URL || '',

  // Big image at the top of the "Join the Queue" page. Leave empty to
  // skip the hero image and use the plain hero layout instead.
  heroImageUrl: '',

  // Shown in a small gallery strip on the join page. Leave as [] to
  // hide the gallery section entirely.
  galleryImages: [
    // 'https://example.com/shop-photo-1.jpg',
    // 'https://example.com/shop-photo-2.jpg',
  ],

  // ---- Team -----------------------------------------------------------
  // Leave photoUrl empty for any barber to auto-generate a clean
  // initials avatar instead of a broken image icon.
  barbers: [
    {
      name: 'Marcus Reyes',
      title: 'Owner & Master Barber',
      photoUrl: '',
      bio: '15 years behind the chair. Specializes in fades and classic straight-razor finishes.',
    },
    {
      name: 'Jordan Blake',
      title: 'Senior Barber',
      photoUrl: '',
      bio: 'Beard sculpting specialist with an eye for detail on every line-up.',
    },
  ],

  // ---- Contact & hours -------------------------------------------------
  address: '123 Main Street, Springfield',
  phone: '(555) 123-4567',
  hours: {
    Mon: '9:00 AM – 6:00 PM',
    Tue: '9:00 AM – 6:00 PM',
    Wed: '9:00 AM – 6:00 PM',
    Thu: '9:00 AM – 7:00 PM',
    Fri: '9:00 AM – 7:00 PM',
    Sat: '9:00 AM – 4:00 PM',
    Sun: 'Closed',
  },

  // Leave any of these empty ('') to hide that social icon in the footer.
  socialLinks: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
};
