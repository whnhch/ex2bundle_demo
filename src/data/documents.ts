// Mock corpus for focused text snippet extraction (FTSE), modelled on the paper's
// user study: Wikipedia-style articles about US states. In Ex2Bundle each sentence
// is mapped to a topic-score vector f(t) ∈ [0, 1]^K by a contextualized topic model
// (CTM + SBERT); here the scores are hand-assigned stand-ins for that model.

export const topics = [
  { id: "demographics", label: "Demographics" },
  { id: "geography", label: "Geography" },
  { id: "economy", label: "Economy" },
  { id: "climate", label: "Climate" },
  { id: "history", label: "History" },
  { id: "government", label: "Government & taxes" },
  { id: "parks", label: "Parks & nature" },
  { id: "cities", label: "Cities" },
  { id: "agriculture", label: "Agriculture" },
  { id: "tourism", label: "Tourism" },
] as const;

export type TopicId = (typeof topics)[number]["id"];
export type TopicVector = Record<TopicId, number>;
// `merit` is the tuple-level quality σ(t) the package query maximizes: the paper's base
// C-FREQ term-frequency quality function (Appendix F).
export type Sentence = { id: string; text: string; scores: TopicVector; words: number; merit: number };
export type SourceDocument = { id: string; title: string; sentences: Sentence[] };
export type DocumentRole = "source" | "target" | "none";

export const topicIds = topics.map((topic) => topic.id) as TopicId[];
export const topicLabels = Object.fromEntries(topics.map((topic) => [topic.id, topic.label])) as Record<TopicId, string>;

export function zeroVector(): TopicVector {
  return Object.fromEntries(topicIds.map((id) => [id, 0])) as TopicVector;
}

const STOPWORDS = new Set("the and for with from that this than into its are was were has have had which while their there also about over most more".split(" "));
const terms = (text: string) => (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => word.length > 2 && !STOPWORDS.has(word));

function doc(id: string, title: string, sentences: [string, Partial<TopicVector>][]): SourceDocument {
  // Term frequency over the whole document; a sentence's merit sums the frequencies of its terms.
  const frequency = new Map<string, number>();
  for (const [text] of sentences) for (const term of terms(text)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  return {
    id,
    title,
    sentences: sentences.map(([text, scores], index) => ({
      id: `${id}-${index + 1}`,
      text,
      scores: { ...zeroVector(), ...scores },
      words: text.split(/\s+/).length,
      merit: [...new Set(terms(text))].reduce((sum, term) => sum + (frequency.get(term) ?? 0), 0),
    })),
  };
}

export const documents: SourceDocument[] = [
  doc("utah", "Utah", [
    ["The largest ancestry groups in the state are 26.0% English and 11.9% German.", { demographics: 0.9 }],
    ["In comparison to all the U.S. states and territories, Utah, with a population of just over three million, is the 13th-largest by area, the 30th-most populous, and the 11th-least densely populated.", { demographics: 0.9, geography: 0.9 }],
    ["St. George was the fastest-growing metropolitan area in the United States from 2000 to 2005.", { demographics: 0.9, geography: 0.3, economy: 0.1 }],
    ["Salt Lake City is the capital and the largest city in the state.", { cities: 0.9, government: 0.3 }],
    ["Utah is home to five national parks, including Zion, Bryce Canyon, and Arches.", { parks: 0.9, tourism: 0.5, geography: 0.2 }],
    ["The Great Salt Lake is the largest saltwater lake in the Western Hemisphere.", { geography: 0.9, parks: 0.3 }],
    ["Tourism, mining, and a growing technology sector known as the Silicon Slopes drive the state's economy.", { economy: 0.9, tourism: 0.3 }],
    ["Most of Utah has a semi-arid to desert climate, with hot summers and snowy winters in the mountains.", { climate: 0.9, geography: 0.2 }],
  ]),
  doc("arizona", "Arizona", [
    ["Phoenix is the capital and the largest city of Arizona.", { cities: 0.9, government: 0.3 }],
    ["Arizona was the last of the contiguous states to be admitted to the Union, in 1912.", { history: 0.9, government: 0.2 }],
    ["The Grand Canyon, carved by the Colorado River, is the state's best-known landmark.", { parks: 0.9, geography: 0.6, tourism: 0.4 }],
    ["Southern Arizona has a desert climate with very hot summers and mild winters.", { climate: 0.9, geography: 0.2 }],
    ["Copper mining has historically been one of the state's most important industries.", { economy: 0.8, history: 0.4 }],
    ["Arizona has one of the largest Native American populations in the country, and tribal lands cover about a quarter of the state.", { demographics: 0.8, geography: 0.3, government: 0.2 }],
    ["The Phoenix metropolitan area is one of the fastest-growing regions in the United States.", { demographics: 0.7, cities: 0.5 }],
    ["Semiconductor manufacturing and aerospace are major parts of the modern economy.", { economy: 0.9 }],
  ]),
  doc("washington", "Washington", [
    ["Olympia is the capital, while Seattle is the largest city.", { cities: 0.9, government: 0.3 }],
    ["The Cascade Range divides the state into a wet western half and a drier eastern half.", { geography: 0.8, climate: 0.7 }],
    ["Olympic National Park protects one of the few temperate rainforests in the United States.", { parks: 0.9, climate: 0.3, tourism: 0.3 }],
    ["Major employers include Microsoft, Amazon, and Boeing.", { economy: 0.9, cities: 0.2 }],
    ["Washington is the leading producer of apples in the United States.", { agriculture: 0.9, economy: 0.4 }],
    ["More than half of the state's residents live in the Seattle metropolitan area around Puget Sound.", { demographics: 0.8, cities: 0.5, geography: 0.2 }],
    ["Mount Rainier, an active stratovolcano, is the highest peak in the state.", { geography: 0.8, parks: 0.5 }],
    ["Washington does not levy a personal income tax on wages.", { government: 0.9, economy: 0.4 }],
  ]),
  doc("california", "California", [
    ["With nearly 39 million residents, California is the most populous U.S. state.", { demographics: 0.9 }],
    ["It is the third-largest state by area, after Alaska and Texas.", { geography: 0.9 }],
    ["Sacramento is the capital, and Los Angeles is the largest city.", { cities: 0.9, government: 0.3 }],
    ["The state's economy is the largest of any U.S. state, led by technology, entertainment, and agriculture.", { economy: 0.9, agriculture: 0.2 }],
    ["The Central Valley is one of the most productive agricultural regions in the world.", { agriculture: 0.9, geography: 0.4, economy: 0.3 }],
    ["The coast has a Mediterranean climate, with dry summers and mild, wet winters.", { climate: 0.9 }],
    ["The Sierra Nevada runs along the eastern side of the state and includes Yosemite National Park.", { parks: 0.8, geography: 0.6, tourism: 0.3 }],
    ["California was admitted to the Union in 1850, shortly after the Gold Rush began.", { history: 0.9, government: 0.2 }],
  ]),
  doc("oregon", "Oregon", [
    ["Salem is the capital, and Portland is the largest city.", { cities: 0.9, government: 0.3 }],
    ["The Cascade Range separates the rainy western valleys from the high desert of eastern Oregon.", { geography: 0.8, climate: 0.6 }],
    ["Crater Lake, the deepest lake in the United States, is the state's only national park.", { parks: 0.9, geography: 0.4, tourism: 0.3 }],
    ["The Oregon Trail brought thousands of settlers to the Willamette Valley in the 1840s.", { history: 0.9, demographics: 0.3 }],
    ["Oregon has no general sales tax.", { government: 0.9, economy: 0.3 }],
    ["Timber was long the backbone of the economy, though technology and manufacturing now lead.", { economy: 0.9, history: 0.3 }],
    ["Oregon became the 33rd state in 1859.", { history: 0.8, government: 0.3 }],
    ["The coast is known for mild, wet winters and cool summers.", { climate: 0.9, geography: 0.3 }],
  ]),
  doc("colorado", "Colorado", [
    ["Denver is the capital and the largest city.", { cities: 0.9, government: 0.3 }],
    ["Colorado has the highest mean elevation of any U.S. state.", { geography: 0.9 }],
    ["The Rocky Mountains run through the center of the state, with more than fifty peaks above 14,000 feet.", { geography: 0.8, parks: 0.4, tourism: 0.3 }],
    ["Colorado became a state in 1876, earning the nickname the Centennial State.", { history: 0.9, government: 0.2 }],
    ["Tourism, especially skiing, is a major part of the economy.", { tourism: 0.9, economy: 0.5 }],
    ["Aerospace, energy, and federal research laboratories are also important employers.", { economy: 0.9 }],
    ["The climate is generally dry and sunny, with heavy snowfall in the mountains.", { climate: 0.9 }],
    ["The population has grown quickly, led by the Denver and Colorado Springs metropolitan areas.", { demographics: 0.8, cities: 0.5 }],
  ]),
  doc("texas", "Texas", [
    ["Texas is the second-largest state in both area and population.", { demographics: 0.7, geography: 0.7 }],
    ["Austin is the capital, and Houston is the largest city.", { cities: 0.9, government: 0.3 }],
    ["Texas was an independent republic from 1836 to 1845 before joining the United States.", { history: 0.9, government: 0.4 }],
    ["Oil and natural gas production have long been central to the state's economy.", { economy: 0.9 }],
    ["The state leads the nation in cattle production.", { agriculture: 0.9, economy: 0.4 }],
    ["The climate ranges from humid in the east to arid in the west.", { climate: 0.9, geography: 0.3 }],
    ["Texas has no personal income tax.", { government: 0.9, economy: 0.3 }],
    ["Several of the fastest-growing large cities in the country are in Texas.", { demographics: 0.7, cities: 0.7 }],
  ]),
  doc("kansas", "Kansas", [
    ["Topeka is the capital, and Wichita is the largest city.", { cities: 0.9, government: 0.3 }],
    ["Kansas lies near the geographic center of the contiguous United States.", { geography: 0.9 }],
    ["Agriculture dominates the landscape, and the state is a leading producer of wheat.", { agriculture: 0.9, economy: 0.4 }],
    ["Wichita is known as the Air Capital of the World for its aircraft manufacturing.", { economy: 0.8, cities: 0.4 }],
    ["Kansas joined the Union in 1861 as a free state after years of conflict known as Bleeding Kansas.", { history: 0.9, government: 0.3 }],
    ["The climate is continental, with hot summers, cold winters, and frequent severe storms.", { climate: 0.9 }],
    ["Most of the state is flat or gently rolling prairie.", { geography: 0.8, agriculture: 0.2 }],
    ["Population growth has concentrated in the Kansas City suburbs while many rural counties have declined.", { demographics: 0.9, cities: 0.3 }],
  ]),
  doc("florida", "Florida", [
    ["Tallahassee is the capital, and Jacksonville is the largest city by population.", { cities: 0.9, government: 0.3 }],
    ["Florida is the third-most populous state.", { demographics: 0.9 }],
    ["Tourism is a cornerstone of the economy, drawing visitors to its beaches and theme parks.", { tourism: 0.9, economy: 0.6 }],
    ["The north has a humid subtropical climate, while the southern tip is tropical.", { climate: 0.9, geography: 0.2 }],
    ["The Everglades, a vast subtropical wetland, covers much of the southern part of the state.", { parks: 0.9, geography: 0.5 }],
    ["Spain ceded Florida to the United States in 1821, and it became a state in 1845.", { history: 0.9, government: 0.3 }],
    ["Florida has no personal income tax.", { government: 0.9, economy: 0.3 }],
    ["Retirees make up a large share of residents, and the median age is among the highest in the country.", { demographics: 0.9 }],
  ]),
];

// Matches the paper's running example: Utah, Arizona and Washington as sources.
export const defaultRoles: Record<string, DocumentRole> = Object.fromEntries(
  documents.map((document, index) => [document.id, index < 3 ? "source" : "target"]),
);
