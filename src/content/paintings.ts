import type { Painting } from "@/lib/content";

// Every public-domain painting sourced for the site. Each file sits in
// public/paintings/, resized to at most 2400px on its long side, and the build
// makes its responsive set. The focal point is the subject to keep in view
// when a phone shows a crop.
export const paintings = {
  stanczyk: {
    src: "/paintings/stanczyk.jpg",
    width: 2400,
    height: 1785,
    source:
      "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
    alt: "The jester Stańczyk slumped alone in a chair, brooding over a letter, while the court dances at a ball in the next room",
    focalPoint: { x: 0.52, y: 0.3 },
    placard: {
      artist: "Jan Matejko",
      title: "Stańczyk",
      year: "1862",
      medium: "Oil on canvas",
      collection: "National Museum in Warsaw",
    },
  },
  "pablo-de-valladolid": {
    src: "/paintings/pablo-de-valladolid.jpg",
    width: 1391,
    height: 2400,
    source:
      "https://commons.wikimedia.org/wiki/File:Vel%C3%A1zquez_-_Pablo_de_Valladolid_(Museo_del_Prado,_1636-37).jpg",
    alt: "The court fool Pablo de Valladolid, dressed in black, standing on an empty ground with one arm flung out as if declaiming",
    focalPoint: { x: 0.55, y: 0.2 },
    placard: {
      artist: "Diego Velázquez",
      title: "Pablo de Valladolid",
      year: "c. 1635",
      medium: "Oil on canvas",
      collection: "Museo del Prado, Madrid",
    },
  },
  calabacillas: {
    src: "/paintings/calabacillas.jpg",
    width: 1854,
    height: 2400,
    source:
      "https://commons.wikimedia.org/wiki/File:Vel%C3%A1zquez_-_El_Buf%C3%B3n_Calabacillas_(Museo_del_Prado,_1636-37).jpg",
    alt: "The court fool Calabacillas sitting on the floor between two gourds, grinning, with his hands clasped over one knee",
    focalPoint: { x: 0.44, y: 0.2 },
    placard: {
      artist: "Diego Velázquez",
      title: "The Buffoon Calabacillas",
      year: "c. 1636–1637",
      medium: "Oil on canvas",
      collection: "Museo del Prado, Madrid",
    },
  },
} as const satisfies { readonly [id: string]: Painting };
