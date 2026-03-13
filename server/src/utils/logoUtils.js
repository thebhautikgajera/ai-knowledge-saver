/**
 * Simple helper to allow swapping logo source if needed.
 * Right now it just returns the template unchanged, but it is
 * wired so you can later replace the logo URL or inline a CID/base64 image.
 */
export const embedLogoInTemplate = (mjmlTemplate) => {
  // If you later want to inline the logo as CID, you can modify the <mj-image> src here.
  return mjmlTemplate;
};

export default {
  embedLogoInTemplate,
};


