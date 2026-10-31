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
  "the-ambassadors": {
    src: "/paintings/the-ambassadors.jpg",
    width: 2394,
    height: 2400,
    source: "https://commons.wikimedia.org/wiki/File:Holbein_Ambassadors.jpg",
    alt: "Two French envoys in fur and silk stand either side of a table laden with globes, instruments, and a lute with a broken string, while a distorted skull stretches across the floor at their feet",
    focalPoint: { x: 0.5, y: 0.22 },
    placard: {
      artist: "Hans Holbein the Younger",
      title: "The Ambassadors",
      year: "1533",
      medium: "Oil on oak",
      collection: "National Gallery, London",
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
  "saint-paul": {
    src: "/paintings/saint-paul.jpg",
    width: 2400,
    height: 1766,
    source:
      "https://commons.wikimedia.org/wiki/File:Valentin_de_Boulogne_-_Saint_Paul_Writing_His_Epistles_-_BF.1991.4_-_Museum_of_Fine_Arts.jpg",
    alt: "The apostle Paul, bearded and robed in red, writing at a table strewn with letters and books in a dark room",
    focalPoint: { x: 0.58, y: 0.22 },
    placard: {
      artist: "Valentin de Boulogne",
      title: "Saint Paul Writing His Epistles",
      year: "c. 1618–1620",
      medium: "Oil on canvas",
      collection: "Sarah Campbell Blaffer Foundation, Houston",
    },
  },
  "sermon-to-the-birds": {
    src: "/paintings/sermon-to-the-birds.jpg",
    width: 956,
    height: 1284,
    source:
      "https://commons.wikimedia.org/wiki/File:Giotto_-_Legend_of_St_Francis_-_-15-_-_Sermon_to_the_Birds.jpg",
    alt: "Saint Francis, in a brown habit and a halo, bending toward a flock of birds on the ground beneath a tree while a fellow friar looks on",
    focalPoint: { x: 0.45, y: 0.6 },
    placard: {
      artist: "Attributed to Giotto",
      title: "Saint Francis Preaching to the Birds",
      year: "c. 1297–1299",
      medium: "Fresco",
      collection: "Upper Basilica of San Francesco, Assisi",
    },
  },
  "boyarynya-morozova": {
    src: "/paintings/boyarynya-morozova.jpg",
    width: 2400,
    height: 1236,
    source:
      "https://commons.wikimedia.org/wiki/File:Vasily_Surikov_-_%D0%91%D0%BE%D1%8F%D1%80%D1%8B%D0%BD%D1%8F_%D0%9C%D0%BE%D1%80%D0%BE%D0%B7%D0%BE%D0%B2%D0%B0_-_Google_Art_Project.jpg",
    alt: "A crowd in a snowy Moscow street watches the noblewoman Morozova, in black and in chains, carried away on a sledge with two fingers raised, while a barefoot holy fool sits in the snow and raises two fingers back to her",
    focalPoint: { x: 0.4, y: 0.38 },
    placard: {
      artist: "Vasily Surikov",
      title: "Boyarynya Morozova",
      year: "1887",
      medium: "Oil on canvas",
      collection: "State Tretyakov Gallery, Moscow",
    },
  },
  yurodivy: {
    src: "/paintings/yurodivy.jpg",
    width: 1416,
    height: 1665,
    source:
      "https://commons.wikimedia.org/wiki/File:Vasily_Surikov_-_%D0%91%D0%BE%D1%8F%D1%80%D1%8B%D0%BD%D1%8F_%D0%9C%D0%BE%D1%80%D0%BE%D0%B7%D0%BE%D0%B2%D0%B0_-_Google_Art_Project_ed_detail_right.jpg",
    alt: "A barefoot holy fool in rags sitting in the snow, raising two fingers toward a passing sledge, with a crowd of Muscovites behind him",
    focalPoint: { x: 0.78, y: 0.6 },
    placard: {
      artist: "Vasily Surikov",
      title: "Boyarynya Morozova (detail)",
      year: "1887",
      medium: "Oil on canvas",
      collection: "State Tretyakov Gallery, Moscow",
    },
  },
  "tres-riches-heures-january": {
    src: "/paintings/tres-riches-heures-january.jpg",
    width: 1333,
    height: 2062,
    source:
      "https://commons.wikimedia.org/wiki/File:Les_Tr%C3%A8s_Riches_Heures_du_duc_de_Berry_Janvier.jpg",
    alt: "The Duke of Berry, in blue and a fur hat, presiding over a New Year's feast at a table laden with gold plate, his guests and servants crowding round, beneath a painted sky marked with the signs of the zodiac",
    focalPoint: { x: 0.7, y: 0.62 },
    placard: {
      artist: "The Limbourg brothers",
      title: "January, from the Très Riches Heures du duc de Berry",
      year: "c. 1412–1416",
      medium: "Paint and gold on vellum",
      collection: "Musée Condé, Chantilly",
    },
  },
  triboulet: {
    src: "/paintings/triboulet.jpg",
    width: 792,
    height: 1156,
    source: "https://commons.wikimedia.org/wiki/File:Triboulet_1550_page.jpg",
    alt: "A chalk drawing of the fool Triboulet, a bearded man with a lined face and a sidelong look, his clothes sketched in a few lines",
    focalPoint: { x: 0.5, y: 0.4 },
    placard: {
      artist: "School of Jean Clouet",
      title: "Triboulet",
      year: "c. 1545",
      medium: "Black and red chalk on paper",
      collection: "Musée Condé, Chantilly",
    },
  },
  "will-somers": {
    src: "/paintings/will-somers.jpg",
    width: 1529,
    height: 1540,
    source:
      "https://commons.wikimedia.org/wiki/File:Henry_VIII_with_harp_-_Psalter_of_Henry_VIII_(1530-1547),_f.63v_-_BL_Royal_MS_2_A_XVI.jpg",
    alt: "King Henry VIII seated in a chamber playing a harp, while his fool Will Somers, in a green coat, stands apart and looks out of the picture",
    focalPoint: { x: 0.74, y: 0.4 },
    placard: {
      artist: "Jean Mallard",
      title: "Henry VIII and Will Somers, from the Psalter of Henry VIII",
      year: "c. 1540",
      medium: "Paint and gold on vellum",
      collection: "British Library, London",
    },
  },
  // A detail: the top of the Commons sheet, cut from its original. The whole
  // sheet's paper grain and print put a phone past its image budget.
  "folly-in-the-pulpit": {
    src: "/paintings/folly-in-the-pulpit.jpg",
    width: 1136,
    height: 937,
    source:
      "https://commons.wikimedia.org/wiki/File:Marginal_Drawings_for_The_Praise_of_Folly_(1),_by_Hans_Holbein_the_Younger.jpg",
    alt: "Folly, in a red fool's cap, leaning from a pulpit to preach to a crowd of fools, drawn in the margin beside the opening of the printed text",
    focalPoint: { x: 0.55, y: 0.35 },
    placard: {
      artist: "Hans Holbein the Younger",
      title: "Folly in the Pulpit, in a copy of In Praise of Folly",
      year: "1515",
      medium: "Pen and ink on a printed page, with red added later",
      collection: "Kunstmuseum Basel",
    },
  },
  "richard-tarlton": {
    src: "/paintings/richard-tarlton.jpg",
    width: 660,
    height: 1072,
    source:
      "https://commons.wikimedia.org/wiki/File:Portrait_of_Richard_Tarlton_(4673035).jpg",
    alt: "The clown Richard Tarlton in a cap and plain smock, playing a pipe with one hand and beating the drum slung at his side with the other",
    focalPoint: { x: 0.45, y: 0.18 },
    placard: {
      artist: "Silvester Harding",
      title: "Richard Tarlton",
      year: "1792",
      medium: "Stipple engraving",
      collection: "National Library of Wales",
    },
  },
  // A detail: the top of the Commons etching, without its verses. The whole
  // print's hatching puts a phone past its image budget.
  "archibald-armstrong": {
    src: "/paintings/archibald-armstrong.jpg",
    width: 600,
    height: 769,
    source: "https://commons.wikimedia.org/wiki/File:Archie_Armstrong.jpg",
    alt: "The fool Archibald Armstrong, long-haired and moustached, in a lace collar and a long cloak, with a rolled paper in one gloved hand",
    focalPoint: { x: 0.53, y: 0.15 },
    placard: {
      artist: "Richard Gaywood",
      title: "Archibald Armstrong",
      year: "c. 1660",
      medium: "Etching",
      collection: "British Museum, London",
    },
  },
  "las-meninas": {
    src: "/paintings/las-meninas.jpg",
    width: 2085,
    height: 2400,
    source: "https://commons.wikimedia.org/wiki/File:Las_Meninas_01.jpg",
    alt: "The young Spanish princess in a white gown, attended by her maids of honor, two court dwarfs, and a dog, while Velázquez stands at his easel and the king and queen appear in a mirror behind",
    focalPoint: { x: 0.6, y: 0.68 },
    placard: {
      artist: "Diego Velázquez",
      title: "Las Meninas",
      year: "1656",
      medium: "Oil on canvas",
      collection: "Museo del Prado, Madrid",
    },
  },
} as const satisfies { readonly [id: string]: Painting };
