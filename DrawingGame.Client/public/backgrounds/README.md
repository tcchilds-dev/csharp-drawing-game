# Game background

Set `USE_IMAGE_BACKGROUND` in `src/config.ts` to `true` to use the image, or
`false` to use the original solid background. It defaults to `false`.

Replace `game-background.jpg` with your own JPEG image, keeping the filename,
then refresh the page. A landscape image at least 1920 pixels wide works well.

To use another filename or format (such as PNG or WebP), put it in this folder
and change `--game-background-image` in `src/index.css` to
`url("/backgrounds/your-filename.webp")`.

The image fills the viewport and crops from the centre. A 45% light overlay in
the `.game-layout[data-image-background="true"]` styles softens the background; lower that percentage for a stronger
image. Images are served locally with the app, without a third-party request.

## Placeholder credit

- Photo: [Photo of Abstract Painting](https://www.pexels.com/photo/photo-of-abstract-painting-2693212/)
- Photographer: [Anni Roenkae](https://www.pexels.com/@anniroenkae/)
- Source: Pexels, photo 2693212, downloaded 26 September 2026.
- License: [Pexels License](https://www.pexels.com/license/), which permits free use on websites and apps.
- Downloaded as a 2400-pixel-wide JPEG from the Pexels image service.
