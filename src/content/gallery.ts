import type { Era, Fool, Gallery } from "@/lib/content";
import { paintings } from "./paintings";

// The Fools' Gallery timeline: each era opens with its painting band, and each
// Fool has an entry framed with their public-domain painting.
const eras = [
  {
    id: "holy-fools",
    title: "Holy Fools",
    period: "1st–17th centuries",
    band: paintings["boyarynya-morozova"],
    intro: {
      title: "Fools for Christ",
      paragraphs: [
        'Before there were jesters in castles, there were fools in the church. Paul wrote to the proud Corinthians, "We are fools for Christ\'s sake," and meant it as a boast: the gospel looked like nonsense to the wise, and the apostles were content to look foolish carrying it.',
        "Francis of Assisi called his friars the jongleurs de Dieu, God's own minstrels and tumblers. In Russia, the yurodivy wandered barefoot through the snow and rebuked tsars to their faces, protected by a reputation for madness that let them say what no courtier dared.",
      ],
      draft: true,
    },
  },
  {
    id: "medieval-court",
    title: "The Medieval Court",
    period: "1100–1450",
    band: paintings["tres-riches-heures-january"],
    intro: {
      title: "The licensed fool",
      paragraphs: [
        "In the great households of medieval Europe, the fool held a strange office. He wore the motley and the cap with its bells, he ate at the lord's table, and he alone could mock the lord without losing his head.",
        "Some fools were simple, kept for the laughter they couldn't help. Others were sharp as knives, and their jokes carried warnings a wise king would heed and a foolish one would not.",
      ],
      draft: true,
    },
  },
  {
    id: "renaissance",
    title: "The Renaissance",
    period: "1450–1600",
    band: paintings["the-ambassadors"],
    intro: {
      title: "Truth in a jest",
      paragraphs: [
        "The Renaissance was the jester's golden age. Stańczyk brooded at the Polish court while others danced, Triboulet traded barbs with the kings of France, and Will Somers could cheer Henry VIII when no one else could.",
        "In 1511 Erasmus published In Praise of Folly, putting a sermon on the vanity of the powerful into Folly's own mouth. Holbein filled the margins of a copy with drawings, and the fool became a voice for reform.",
      ],
      draft: true,
    },
  },
  {
    id: "reformation",
    title: "The Reformation",
    period: "1517–1660",
    band: paintings["las-meninas"],
    intro: {
      title: "The last of the court fools",
      paragraphs: [
        "As Europe argued over the gospel, the fools argued too. Richard Tarlton made Elizabeth I laugh until she ordered him from the room, and Archibald Armstrong mocked Archbishop Laud so openly that he lost his place at court.",
        "In Spain, Velázquez painted the court fools of Philip IV with a dignity their masters rarely gave them. Within a generation the office was gone, but the fool's privilege of telling the truth with a smile was not.",
      ],
      draft: true,
    },
  },
] as const satisfies readonly Era[];

const fools = [
  {
    slug: "paul",
    name: "Saint Paul",
    era: "holy-fools",
    lived: "Died c. 64–67",
    story: {
      title: "A fool for Christ's sake",
      paragraphs: [
        'Paul was a learned man, trained in the law at the feet of Gamaliel, and he knew exactly how the gospel sounded to learned ears. A crucified Messiah was a stumbling block to Jews, he wrote, and foolishness to Greeks. He didn\'t soften it. "The foolishness of God is wiser than men," he told the Corinthians, and God had chosen the foolish things of the world to confound the wise.',
        'The church at Corinth grew proud of its wisdom, and Paul answered with an irony any court fool would envy: "We are fools for Christ\'s sake, but ye are wise in Christ; we are weak, but ye are strong." Later, made to defend himself against rivals who boasted of their credentials, he played the fool on purpose. He boasted of beatings, shipwrecks, and being let down the wall of Damascus in a basket. "I am become a fool in glorying," he wrote; "ye have compelled me."',
        "Valentin de Boulogne painted him at his desk, pen in hand, with a letter half written. Every holy fool after him took Paul's phrase as a calling: to look foolish to the world for the sake of a truth the world couldn't see.",
      ],
      draft: true,
    },
    painting: paintings["saint-paul"],
  },
  {
    slug: "francis-of-assisi",
    name: "Francis of Assisi",
    era: "holy-fools",
    lived: "c. 1181–1226",
    story: {
      title: "God's minstrel",
      paragraphs: [
        "Francis was a rich cloth merchant's son who dreamed of being a knight. After his conversion he stood before the bishop of Assisi, took off his clothes, and handed them back to his father, saying that from then on he would call only God his Father. The town decided he had lost his mind, and people threw mud and stones at him in the streets.",
        "He never minded looking ridiculous. He sang God's praises in French as he walked the roads, preached to anyone who would listen, and called his brothers the Lord's jongleurs: God's minstrels, he said, whose work was to lift people's hearts and move them to spiritual joy.",
        "In the upper church at Assisi, the painter of his life shows him bending toward a flock of birds by the roadside while a brother friar holds back in wonder. His first biographer says the birds stretched out their necks and listened, and didn't fly until Francis blessed them and gave them leave to go.",
      ],
      draft: true,
    },
    painting: paintings["sermon-to-the-birds"],
  },
  {
    slug: "yurodivy",
    name: "The yurodivy",
    era: "holy-fools",
    lived: "15th–17th centuries",
    story: {
      title: "Barefoot in the snow",
      paragraphs: [
        "In Russia the holy fool became an institution. The yurodivy went barefoot through the winter in rags or chains, slept in church porches, and spoke in riddles. People feared and honored him in equal measure, because his madness was understood as a disguise. A man who had given up everything, even his good name, had nothing left to lose by telling the truth.",
        "Basil the Blessed walked naked through Moscow's winters, and the cathedral on Red Square where he was buried still bears his name. When Ivan the Terrible came to Pskov in 1570, fresh from slaughtering the people of Novgorod, the story goes that the holy fool Nikola offered him a slab of raw meat. Ivan protested that it was Lent and he was a Christian. Nikola asked why, then, he drank Christian blood. Ivan left Pskov largely unharmed.",
        "Vasily Surikov's yurodivy sits barefoot in the snow as the Old Believer noblewoman Morozova is carted off to prison, raising two fingers in the old sign of the cross to answer hers. Surikov found his model selling cucumbers in a Moscow market, and painted him sitting in real snow.",
      ],
      draft: true,
    },
    painting: paintings.yurodivy,
  },
  {
    slug: "stanczyk",
    name: "Stańczyk",
    era: "renaissance",
    lived: "c. 1480–1560",
    story: {
      title: "The fool who wouldn't dance",
      paragraphs: [
        "Stańczyk served three kings of Poland, and the Kraków court remembered him less for his clowning than for his nerve. The story goes that at a royal hunt King Sigismund had a bear let out of its cage, and when it charged, Stańczyk ran. The king scolded him for fleeing. Stańczyk answered that the greater fool was the one who lets a bear out of its cage.",
        "Another story has him walking through Kraków with his face bound in a bandage, to settle a bet over which trade had the most practitioners. Everyone he passed offered him a cure, and he won the bet: the city was full of doctors.",
        "Three centuries later, Jan Matejko painted him alone at a ball. In the next room the court dances; on the table beside him lies a letter announcing that Smolensk has fallen to Moscow. Only the fool understands what it means. This painting gave the show its name: a fool who sees the truth while the court looks away.",
      ],
      draft: true,
    },
    painting: paintings.stanczyk,
  },
  {
    slug: "triboulet",
    name: "Triboulet",
    era: "renaissance",
    lived: "c. 1479–1536",
    story: {
      title: "A quarter of an hour before",
      paragraphs: [
        'Triboulet served two kings of France, Louis XII and Francis I, and his jokes had a way of finding the most powerful person in the room. The best-known story says a nobleman he had mocked swore to kill him. Triboulet ran to the king, who promised that anyone who murdered his fool would hang a quarter of an hour later. "Sire," said Triboulet, "might he hang a quarter of an hour before?"',
        "Rabelais put him in the Third Book of Pantagruel. Panurge can't decide whether to marry, and after consulting a theologian, a physician, and a philosopher, he is sent at last to the fool Triboulet, on the theory that a fool might see what the wise had missed.",
        "Three centuries later Victor Hugo made him the hero of Le roi s'amuse, a play so hard on the king that it was banned after one night. Verdi set the story to music, and Triboulet became Rigoletto. This chalk drawing at Chantilly has long carried his name, though it was made around 1545, after his death, so no one can be sure the face is his.",
      ],
      draft: true,
    },
    painting: paintings.triboulet,
  },
  {
    slug: "will-somers",
    name: "Will Somers",
    era: "renaissance",
    lived: "Died 1560",
    story: {
      title: "The fool in the king's psalter",
      paragraphs: [
        "Will Somers came to Henry VIII's court from Shropshire around 1535 and stayed for the rest of the reign. As the king grew older, sicker, and more dangerous, Somers was one of the few people who could still make him laugh, and one of the few who could tell him the truth while doing it.",
        'Thomas Wilson\'s Art of Rhetoric, printed while Somers was still alive, records him explaining to the king why the treasury was always empty: Henry had so many auditors about him, and so many "frauditors", that they kept the money for themselves.',
        "He outlived Henry, served Edward VI and Mary, and was still at court for Elizabeth's coronation. In Henry's own psalter, at the psalm that begins \"The fool hath said in his heart, There is no God,\" the king sits as David with his harp, and his fool stands beside him.",
      ],
      draft: true,
    },
    painting: paintings["will-somers"],
  },
  {
    slug: "erasmus",
    name: "Erasmus",
    era: "renaissance",
    lived: "c. 1466–1536",
    story: {
      title: "Folly in the pulpit",
      paragraphs: [
        "Erasmus wrote In Praise of Folly in 1509 while staying with his friend Thomas More in London, and he said it took him only a few days. The Greek title, Moriae Encomium, puns on More's name. Folly herself climbs into the pulpit and preaches a sermon in her own praise, and along the way she mocks everyone who thinks himself wise: theologians splitting hairs, monks counting their fasts, popes and kings living in luxury.",
        "Then the joke turns. In her last pages Folly quotes Paul: the foolishness of God is wiser than men, and Christians must be fools for Christ's sake. The book that laughed at the church's pride ended by commending the folly of the cross, and it was read across Europe on the eve of the Reformation.",
        "In 1515 a Basel schoolmaster, Oswald Myconius, let the young Hans Holbein and his brother Ambrosius fill the margins of his copy with 82 pen drawings. The first shows Folly, in her fool's cap, preaching from the pulpit. When Erasmus saw the sketch of himself at his desk, he is said to have remarked that if he still looked like that, he would take a wife.",
      ],
      draft: true,
    },
    painting: paintings["folly-in-the-pulpit"],
  },
  {
    slug: "richard-tarlton",
    name: "Richard Tarlton",
    era: "reformation",
    lived: "Died 1588",
    story: {
      title: "More of her faults than her chaplains",
      paragraphs: [
        "Richard Tarlton was the most famous clown in Elizabethan England, a star of the Queen's Men who could make up rhymes on any subject the crowd shouted at him. He played the pipe and tabor, danced the jig that ended the show, and, a poet remembered, only had to put his head round the curtain for the whole theatre to laugh.",
        "He made the queen laugh too, and he didn't spare her court. Once, the story goes, he mocked Sir Walter Raleigh and the Earl of Leicester so mercilessly in her presence that she had him taken away for making her laugh too much. Thomas Fuller wrote that Tarlton told the queen more of her faults than most of her chaplains, and cured her melancholy better than all her physicians.",
        'He died in 1588, poor, and some readers have heard him in Hamlet\'s Yorick, "a fellow of infinite jest," whose skull the prince holds in the graveyard. This engraving copies an Elizabethan drawing of him, pipe at his lips and drum at his side.',
      ],
      draft: true,
    },
    painting: paintings["richard-tarlton"],
  },
  {
    slug: "archibald-armstrong",
    name: "Archibald Armstrong",
    era: "reformation",
    lived: "Died 1672",
    story: {
      title: "Who's fool now?",
      paragraphs: [
        "Archibald Armstrong, Archy to the court, came south from the Scottish borders with James VI when he became James I of England in 1603. Legend says he had been a sheep stealer. He grew rich, rude, and indispensable, and in 1623 he went with Prince Charles to Madrid, where a courtier wrote home that Archy had more privilege than any of them, going in his fool's coat wherever the princess was.",
        'Under Charles I he chose the wrong enemy: William Laud, Archbishop of Canterbury. Asked to say grace at a dinner Laud attended, Archy prayed, "Great praise be given to God, and little Laud to the devil." When Laud\'s new prayer book set off a riot in Edinburgh in 1637, Archy asked him, "Who\'s fool now?" Laud complained to the Privy Council, and in 1638 Archy was stripped of his fool\'s coat and put out of the court.',
        "He retired to Cumberland with the fortune his jokes had made, and lived to see Laud beheaded in 1645 and the king after him. Richard Gaywood etched him for A Banquet of Jests, a book of jokes sold under his name.",
      ],
      draft: true,
    },
    painting: paintings["archibald-armstrong"],
  },
  {
    slug: "pablo-de-valladolid",
    name: "Pablo de Valladolid",
    era: "reformation",
    lived: "Died 1648",
    story: {
      title: "Surrounded by air",
      paragraphs: [
        "Pablo de Valladolid served at the court of Philip IV of Spain from 1632 until his death, one of the hombres de placer, the men of pleasure kept to amuse the king. Almost nothing else is known of him: not his jokes, not his history, not what he thought of his master.",
        "What survives is his portrait by Velázquez. He stands in black on a ground with no floor, no wall, and no horizon, one arm flung out as if in the middle of a speech. When Édouard Manet saw it in the Prado in 1865, he called it perhaps the most astonishing piece of painting ever done: the background disappears, he wrote, and air surrounds the man.",
        "In Las Meninas, two of the court's dwarfs stand beside the princess among her maids of honor. The court kept such people as curiosities; Velázquez painted them as he painted the king himself, as people who look back at us.",
      ],
      draft: true,
    },
    painting: paintings["pablo-de-valladolid"],
  },
  {
    slug: "calabacillas",
    name: "Calabacillas",
    era: "reformation",
    lived: "Died 1639",
    story: {
      title: "Between two gourds",
      paragraphs: [
        "Juan Martín Martín, known at court as Calabacillas, came to Philip IV's household from the service of the king's brother, the Cardinal-Infante Ferdinand, and stayed until his death in 1639. Where Pablo de Valladolid seems to have been kept for his wit, Calabacillas seems to have been kept for his simplicity: one of the fools the court laughed at rather than with.",
        "Velázquez painted him sitting on the floor between two gourds, calabazas, a pun on his nickname and the old Spanish emblem of an empty head. He squints and grins, and the painter's loose, quick brush refuses to make a joke of him. For centuries the canvas was misnamed The Simpleton of Coria, as if the man in it didn't need a name of his own.",
      ],
      draft: true,
    },
    painting: paintings.calabacillas,
  },
] as const satisfies readonly Fool[];

export const gallery = {
  title: "The Fools' Gallery",
  intro: {
    text: "For as long as there have been kings, there have been fools who told them the truth. Some wore the motley at court; others went barefoot for Christ. Walk through their history, era by era, painting by painting.",
    draft: true,
  },
  eras,
  fools,
  closing: {
    title: "Why this show wears the motley",
    paragraphs: [
      "The fools in this gallery served earthly kings, and the best of them loved their kings enough to tell them the truth. We serve a better King, one who needs no jester, but who has given his church a voice and asked her to use it.",
      "So we put on the motley. We laugh at church culture, at its fads and its celebrities and its strange habits, and we laugh at ourselves first. Then we open the Scriptures, because the point of the jest was always that the king would listen.",
    ],
    draft: true,
  },
} as const satisfies Gallery;
