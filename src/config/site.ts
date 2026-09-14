/**
 * Site name and wording. Edit the text here to rename the site or change the
 * introduction and About section. Designs themselves are managed at /admin.
 */
export const siteConfig = {
  /** Shown in the header, browser tab, and link previews. */
  name: "Bidipta Roy | Educational Design",
  /** Used in the footer copyright line. */
  owner: "Bidipta Roy",
  description:
    "A portfolio of original educational T-shirt designs about biology, immunology, anatomy, neuroscience, computer science, and more.",

  intro: {
    eyebrow: "Educational T-shirt designs",
    headline: "Artwork that teaches something.",
    lede: "Original designs made by two siblings. Each one is built around a real idea from science or computing, drawn clearly enough to learn from at a glance.",
  },

  about: {
    heading: "Why we design educational shirts",
    paragraphs: [
      "We are a pair of siblings who enjoy the moment a difficult idea finally makes sense, like how the immune system recognizes an invader or how a neuron passes a signal along.",
      "We started designing T-shirts as a way to capture ideas like these in artwork that is accurate, easy to read, and good to look at. Every design here is our own original work.",
      "This site is our portfolio, and we add new designs as we finish them.",
    ],
  },
} as const;
