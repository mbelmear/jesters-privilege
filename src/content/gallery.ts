import type { Era, Fool, Gallery } from "@/lib/content";
import { paintings } from "./paintings";

// The Fools' Gallery timeline: each era opens with its painting band, and each
// Fool has an entry framed with their public-domain painting.
//
// Every fact, line, and respelling below traces to
// docs/research/fools-jests-and-pronunciations.md. Quotations from English
// sources keep their words and modernize only their spelling; lines from
// Polish, French, and Latin are the research file's translations.
const eras = [
  {
    id: "holy-fools",
    title: "Holy Fools",
    period: "1st–17th centuries",
    band: paintings["boyarynya-morozova"],
    intro: {
      title: "Fools for Christ",
      paragraphs: [
        "Before there were jesters in castles, there were fools in the church. Paul boasted that the apostles were \"fools for Christ's sake,\" and the saints after him took him at his word: friars sang as God's minstrels, and holy men walked naked through Russian winters to tell tsars what their courtiers wouldn't.",
      ],
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
        "In the great households of medieval Europe, the fool held a strange place at court. He wore the motley and the cap with its bells, he ate at the lord's table, and he alone could mock the lord without losing his head. Some fools were simple, kept for the laughs they couldn't help; others were sharp as knives.",
      ],
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
        "The Renaissance was the jester's golden age. Kings in Poland, France, and England kept fools at their elbows, some for their wit and at least one for his lack of it. In 1511 Erasmus handed Folly herself the floor for a speech in her own praise, and she spared neither popes nor theologians.",
      ],
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
        "As Europe argued over the gospel, the fools argued too, and paid for it: an English queen had her comic actor taken away for making her laugh too hard, and an archbishop got the king's fool thrown out of court. In Spain, Velázquez painted Philip IV's fools with a dignity their masters rarely gave them.",
      ],
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
        'Paul was a learned man, trained in the law at the feet of Gamaliel, and he knew exactly how the gospel sounded to learned ears. A crucified Messiah, he wrote, was "a stumbling block to Jews and folly to Gentiles." He didn\'t soften it. "The foolishness of God is wiser than men," he told the Corinthians, and "God chose what is foolish in the world to shame the wise."',
        'The church at Corinth grew proud of its wisdom, and Paul answered with an irony any court fool would envy: "We are fools for Christ\'s sake, but you are wise in Christ. We are weak, but you are strong." Later, made to defend himself against rivals who boasted of their credentials, he played the fool on purpose. He boasted of beatings, shipwrecks, and being let down the wall of Damascus in a basket. "I have been a fool!" he wrote. "You forced me to it."',
        "Valentin de Boulogne painted him at his desk, pen in hand, with a letter half written. Every holy fool after him took Paul's phrase as a calling: to look foolish to the world for the sake of a truth the world couldn't see.",
      ],
    },
    painting: paintings["saint-paul"],
  },
  {
    slug: "francis-of-assisi",
    name: "Francis of Assisi",
    respelling: "Francis of ah-SEE-see",
    era: "holy-fools",
    lived: "c. 1181–1226",
    story: {
      title: "God's minstrel",
      paragraphs: [
        "Francis was a rich cloth merchant's son who dreamed of being a knight. After his conversion he stood before the bishop of Assisi, took off his clothes, and handed them back to his father, saying that from then on he would call only God his Father. The town decided he had lost his mind, and people threw mud and stones at him in the streets.",
        "He never minded looking ridiculous. He sang God's praises in French as he walked the roads, preached to anyone who would listen, and called his brothers the Lord's jongleurs: God's minstrels, he said, whose work was to lift people's hearts and move them to spiritual joy.",
        "In the upper church at Assisi, the painter of his life shows him bending toward a flock of birds by the roadside while a brother friar holds back in wonder. His first biographer says the birds stretched out their necks and listened, and didn't fly until Francis blessed them and gave them leave to go.",
      ],
    },
    painting: paintings["sermon-to-the-birds"],
  },
  {
    slug: "yurodivy",
    name: "The yurodivy",
    respelling: "yoo-ROH-dih-vee",
    era: "holy-fools",
    lived: "15th–17th centuries",
    story: {
      title: "Barefoot in the snow",
      paragraphs: [
        'In Russia the holy fool, the yurodivy, went naked even in the depths of winter, and the people took him for a prophet. The Englishman Giles Fletcher, who saw them in Moscow, wrote that they were given "a liberty to speak what they list," even against the tsar himself. Basil the Blessed rebuked Ivan the Terrible for his cruelty, and was made a saint.',
      ],
      jests: [
        {
          setup:
            "In 1570 Ivan came to sack Pskov on suspicion of rebellion. The hermit Nikola sent him a piece of raw meat. It was Lent, and when the tsar sent word that he was surprised a holy man would offer him meat in Lent, Nikola answered, as Fletcher recorded it:",
          line: "And doth Ivasko (which is as much to say, as Jack) think … that it is unlawful to eat a piece of beast's flesh in Lent, and not to eat up so much man's flesh as he hath done already?",
        },
        {
          setup:
            'Jerome Horsey, an Englishman who saw Nikola with his own eyes and thought him "a foul creature," still recorded him calling the tsar to his face, as a storm broke over the town:',
          line: "… the Emperor bloodsucker, the devourer and eater of Christian flesh …",
        },
      ],
      coda: 'The words, Horsey wrote, "made the Emperor to tremble," and Fletcher says the fool "saved a great many men\'s lives at that time."',
    },
    painting: paintings.yurodivy,
  },
  {
    slug: "stanczyk",
    name: "Stańczyk",
    respelling: "STAHN-chik",
    era: "renaissance",
    lived: "c. 1480–c. 1560",
    story: {
      title: "The fool who wouldn't dance",
      paragraphs: [
        'Stańczyk was the fool of two kings of Poland, Alexander and Sigismund I, and perhaps of a third. His contemporary, the chronicler Marcin Bielski, called him "an exceptional fool," and warned that lords make a mistake joking with fools, "for they like to tell the truth in jest."',
      ],
      jests: [
        {
          setup:
            "A huge bear from Lithuania was let out of its crate to be baited before the court. It mauled the dogs, charged the royal party, and knocked Stańczyk over, horse and all. The king laughed that he had run from the bear like a fool, not a knight. Stańczyk answered:",
          line: "He's the bigger fool who has a bear in a crate and lets it out to his own harm.",
        },
        {
          setup:
            "The poet Jan Kochanowski recorded his verdict on two of the court's bishops:",
          line: 'Stańczyk used to say there were no bigger liars in Poland than Archbishop Gamrat and Maciejowski, Bishop of Kraków: the first always said "I know everything" and knew nothing, and the second said "I really don\'t know" and knew everything.',
        },
        {
          setup:
            "When some boys tore the clothes off him, he ran to the king, who took pity on him. Stańczyk told him:",
          line: "They're skinning you worse than me, king: Smolensk has been torn away from you, and you say nothing.",
        },
      ],
      // The coda is Michael's approved line (2026-11-03, #116).
      coda: "It's Michael's favorite painting, and it helped name this show: a fool who sees the truth while the court dances on without him.",
    },
    painting: paintings.stanczyk,
  },
  {
    slug: "triboulet",
    name: "Triboulet",
    respelling: "tree-boo-LAY",
    era: "renaissance",
    lived: "c. 1479–c. 1537",
    story: {
      title: "Other men's jokes",
      paragraphs: [
        'Triboulet was the household fool of Louis XII and Francis I, though two fools of that name may have been merged into one. The poet Jean Marot, who knew him, called him "a fool with a cracked head, as wise at thirty as the day he was born": a natural fool, kept for his simplicity. Later writers lent him other men\'s jokes, and Victor Hugo made him the hero of a play banned after one night.',
      ],
      jests: [
        {
          setup:
            "The storyteller Bonaventure des Périers tells how at the king's entry into Rouen in 1508, Triboulet was sent ahead on a fine horse to announce him. When his keeper shouted at him to stop, Triboulet, afraid of a beating, hauled on the reins and drove his spurs in as hard as he could:",
          line: "By God's blood, this wicked horse! I spur it as hard as I can, and it still won't stand still!",
        },
        {
          setup:
            "The story goes that at vespers in the Sainte-Chapelle, a bishop began to chant, the choir burst in, and Triboulet walked up and punched the bishop. Asked by the king why, he said:",
          line: "Well, cousin, when we came in here it was quiet, and this fellow started the racket, so he's the one to punish.",
        },
        {
          setup:
            "The story also goes, as it goes of at least half a dozen other fools, that a lord threatened to have him beaten to death, and the king promised to hang the man a quarter of an hour after Triboulet died. Triboulet asked:",
          line: "Thank you kindly, cousin, but would you be so good as to hang him a quarter of an hour before?",
        },
      ],
    },
    painting: paintings.triboulet,
  },
  {
    slug: "will-somers",
    name: "Will Somers",
    era: "renaissance",
    lived: "Died 1560",
    story: {
      title: "So many frauditors",
      paragraphs: [
        'Will Somers was Henry VIII\'s fool, first recorded at court in 1535, and he went on to serve Edward VI and Mary. The actor Robert Armin, writing when "so many knew him," remembered a lean, stooping man, "a poor man\'s friend," whose merry talk "exiled sadness many a time" for the king.',
      ],
      jests: [
        {
          setup:
            "When Henry was short of money owed him, Somers explained why. Thomas Wilson printed the answer in 1553, while Somers was alive, as a lesson in punning:",
          line: "And please your grace, quoth he, you have so many frauditors, so many conveyers, and so many deceivers to get up your money, that they get all to themselves.",
        },
        {
          setup:
            "The story goes, in Armin's telling, that when Henry was so low that nothing could cheer him, Will went behind the arras to think and came back with three riddles, the last of them bawdy. The first:",
          line: "Harry, says he, what is it, that the lesser it is, the more it is to be feared? … it was a little bridge over a deep river.",
        },
      ],
    },
    painting: paintings["will-somers"],
  },
  {
    slug: "erasmus",
    name: "Erasmus",
    respelling: "ih-RAZ-mus",
    era: "renaissance",
    lived: "c. 1466–1536",
    story: {
      title: "Folly takes the floor",
      paragraphs: [
        'Erasmus thought of In Praise of Folly while riding from Italy to England, and printed it in 1511. Its title, Moriae Encomium, puns on the name of his friend Thomas More, which, he told More, "comes so near the word Moriae (folly) as you are far from the thing." The book is a mock speech, and Folly delivers it in her own praise.',
      ],
      jests: [
        {
          setup:
            "Her proof that she is a goddess is what happened when she appeared:",
          line: "I no sooner stepped up to speak to this full assembly than all your faces put on a kind of new and unwonted pleasantness.",
        },
        {
          setup:
            "Touring the powerful, past the theologians, monks, and bishops, she comes to the popes:",
          line: "And for popes, that supply the place of Christ, if they should endeavor to imitate His life, to wit His poverty, labor, doctrine, cross, and contempt of life … who would live more disconsolate than themselves?",
        },
        {
          setup:
            'Then the joke turns. Folly piles up texts from Paul, praises "the foolishness of the cross," excuses anything too bold as a fool\'s talk, and leaves with a proverb:',
          line: "Sometimes a fool may speak a word in season … Wherefore farewell, clap your hands, live and drink lustily, my most excellent disciples of Folly.",
        },
      ],
    },
    painting: paintings["folly-in-the-pulpit"],
  },
  {
    slug: "richard-tarlton",
    name: "Richard Tarlton",
    era: "reformation",
    lived: "Died 1588",
    story: {
      title: "Take away the knave",
      paragraphs: [
        'Richard Tarlton was the most famous comic actor of Elizabethan England, one of the twelve players chosen for the new Queen\'s Men in 1583. He made up verses on any theme the crowd shouted, and Thomas Nashe wrote that people began to laugh the moment he "first peeped out his head." He died poor, in 1588. Thomas Fuller, writing in 1662, long after he died, said he told the queen "more of her faults than most of her chaplains."',
      ],
      jests: [
        {
          setup:
            "A court note from the year he died records how Tarlton, a master of fence, fought the queen's lapdog with sword and staff as if it were a fighting mastiff:",
          line: "… the Queen bade them take away the knave for making her to laugh so excessively, as he fought against her little dog, Perrico de Faldas, with his sword and long staff, and bade the Queen take off her mastiff.",
        },
        {
          setup:
            "The story goes, in a book printed a century later, that one joke cost him his place at her table. Acting before the queen, he pointed at Sir Walter Raleigh:",
          line: "See, the Knave commands the Queen!",
        },
        {
          setup:
            "The story also goes that he compared Queen Elizabeth to a sculler, who rows alone:",
          line: "… neither the Queen nor the sculler hath a fellow.",
        },
      ],
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
        "Archibald Armstrong, Archy to the court, was the fool of James VI and I and of Charles I. Tradition says he began as a sheep-stealer on the Scottish border. He went with Prince Charles to Madrid in 1623, grew rich, and made the mistake of choosing William Laud, Archbishop of Canterbury, as his target.",
      ],
      jests: [
        {
          setup:
            "In a letter from Madrid, James Howell wrote that \"our cousin Archy hath more privilege than any,\" going in his fool's coat among the Infanta's ladies. When they marveled at a Catholic victory at Prague, Archy offered them a stranger thing:",
          line: "Was it not a strange thing, quoth he, that in the year '88 there should come a fleet of 140 sail from Spain to invade England, and that ten of these could not go back to tell what became of the rest?",
        },
        {
          setup:
            "The story goes that Archy asked leave to say grace before the king, with Laud, a little man, at the table:",
          line: "Great praise be given to God, and little Laud to the devil.",
        },
        {
          setup:
            "On 11 March 1638, with news from Stirling about the new Scottish prayer book, Archy met Laud on his way into the Council:",
          line: "Whea's feule now? doth not your Grace hear the News from Striveling about the Liturgy?",
        },
      ],
      coda: "The complaint went straight to the Council, and that same day the king and Council had Archy's coat pulled over his head and put him out of the king's service and the court.",
    },
    painting: paintings["archibald-armstrong"],
  },
  {
    slug: "pablo-de-valladolid",
    name: "Pablo de Valladolid",
    respelling: "PAH-bloh deh bah-yah-doh-LEED",
    era: "reformation",
    lived: "Died 1648",
    story: {
      title: "Surrounded by air",
      paragraphs: [
        "Pablo de Valladolid served at the court of Philip IV of Spain from 1632 until his death, one of the hombres de placer, the men of pleasure kept to amuse the king. Almost nothing else is known of him: not his jokes, not his history, not what he thought of his master.",
        "What survives is his portrait by Velázquez. He stands in black on a ground with no floor, no wall, and no horizon, one arm flung out as if in the middle of a speech. When Édouard Manet saw it in the Prado in 1865, he called it perhaps the most astonishing piece of painting ever done: the background disappears, he wrote, and air surrounds the man.",
        "In Las Meninas, two of the court's dwarfs stand beside the princess among her maids of honor. The court kept such people as curiosities; Velázquez painted them as he painted the king himself, as people who look back at us.",
      ],
    },
    painting: paintings["pablo-de-valladolid"],
  },
  {
    slug: "calabacillas",
    name: "Calabacillas",
    respelling: "kah-lah-bah-THEE-yahs",
    era: "reformation",
    lived: "Died 1639",
    story: {
      title: "Between two gourds",
      paragraphs: [
        "Juan Martín Martín, known at court as Calabacillas, came to Philip IV's household from the service of the king's brother, the Cardinal-Infante Ferdinand, and stayed until his death in 1639. Where Pablo de Valladolid seems to have been kept for his wit, Calabacillas seems to have been kept for his simplicity: one of the fools the court laughed at rather than with.",
        "Velázquez painted him sitting on the floor between two gourds, calabazas, a pun on his nickname and the old Spanish emblem of an empty head. He squints and grins, and the painter's loose, quick brush refuses to make a joke of him. For centuries the canvas was misnamed The Simpleton of Coria, as if the man in it didn't need a name of his own.",
      ],
    },
    painting: paintings.calabacillas,
  },
] as const satisfies readonly Fool[];

export const gallery = {
  title: "The Fools' Gallery",
  intro: {
    text: "For as long as there have been kings, there have been fools who told them the truth. Some wore the motley at court; others went barefoot for Christ. Walk through their history, era by era, painting by painting.",
  },
  eras,
  fools,
  closing: {
    title: "Why this show wears the motley",
    paragraphs: [
      "The fools in this gallery served earthly kings. The best of them loved their kings enough to risk a jest that told the truth, when every courtier around the throne would only flatter. The laugh was never the point. The point of the jest was always that the king would listen.",
      "Our King needs no such service. He is never deceived and never wrong. But his church can wander, and she has flatterers of her own: fads, celebrities, and voices that tell her only what she wants to hear.",
      "So, as fools for Christ, we put on the motley. We laugh at church culture, and at ourselves first. Then we open the Scriptures, so that while the church laughs, she listens to her King.",
    ],
  },
} as const satisfies Gallery;
