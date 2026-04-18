export interface Passage {
  id: string;
  text: string;
  length: 'short' | 'medium' | 'long';
  source?: string;
}

export const PASSAGES: Passage[] = [
  // --- SHORT (20 passages, 18-32 words) ---
  {
    id: 'short-aurelius-01',
    text: 'Very little is needed to make a happy life. It is all within yourself, in your way of thinking. The present moment is the only one you ever truly have.',
    length: 'short',
    source: 'Marcus Aurelius',
  },
  {
    id: 'short-seneca-01',
    text: 'It is not that we have a short time to live, but that we waste much of it. Life is long enough if it is well spent and skillfully used.',
    length: 'short',
    source: 'Seneca',
  },
  {
    id: 'short-thoreau-01',
    text: 'Go confidently in the direction of your dreams. Live the life you have imagined. As you simplify your life, the laws of the universe will be simpler.',
    length: 'short',
    source: 'Henry David Thoreau',
  },
  {
    id: 'short-austen-01',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife, though his feelings on the matter are rarely consulted.',
    length: 'short',
    source: 'Jane Austen',
  },
  {
    id: 'short-pangram-01',
    text: 'The quick brown fox jumps over the lazy dog as the late autumn sun settles into a warm orange behind the silent hills just beyond the old stone bridge.',
    length: 'short',
  },
  {
    id: 'short-pangram-02',
    text: 'Pack my box with five dozen liquor jugs, then carry them up the winding stairs to the attic where the old wooden crates have been waiting for many long quiet years.',
    length: 'short',
  },
  {
    id: 'short-constitution-01',
    text: 'We the people, in order to form a more perfect union, establish justice, ensure domestic tranquility, and secure the blessings of liberty, ordain this constitution.',
    length: 'short',
    source: 'US Constitution',
  },
  {
    id: 'short-socrates-01',
    text: 'The unexamined life is not worth living. To know yourself is the beginning of wisdom. Wonder, not doubt, is the true root of knowledge and honest inquiry.',
    length: 'short',
    source: 'Socrates',
  },
  {
    id: 'short-heraclitus-01',
    text: 'No man ever steps in the same river twice, for it is not the same river and he is not the same man. Everything flows, nothing stays still or fixed.',
    length: 'short',
    source: 'Heraclitus',
  },
  {
    id: 'short-shakespeare-01',
    text: 'Since brevity is the soul of wit, and tediousness the limbs and outward flourishes, I will be brief. Your noble son is mad, and madness is to define true madness.',
    length: 'short',
    source: 'William Shakespeare',
  },
  {
    id: 'short-tolstoy-01',
    text: 'Happy families are all alike; every unhappy family is unhappy in its own way. Everything was in confusion in the house, and no one knew quite what to do.',
    length: 'short',
    source: 'Leo Tolstoy',
  },
  {
    id: 'short-original-morning-01',
    text: 'The coffee machine hummed while rain tapped against the kitchen window. She opened the old notebook, clicked her pen, and began to write the first line she had waited months to write.',
    length: 'short',
  },
  {
    id: 'short-original-walk-01',
    text: 'He walked through the narrow streets at dusk, counting each lit window, wondering whether anyone behind those panes was counting anything at all or just watching the night arrive.',
    length: 'short',
  },
  {
    id: 'short-aurelius-02',
    text: 'Confine yourself to the present. Waste no more time arguing about what a good person should be. Be one. The best revenge is to not be like the one who harmed you.',
    length: 'short',
    source: 'Marcus Aurelius',
  },
  {
    id: 'short-twain-01',
    text: 'The two most important days in your life are the day you are born and the day you find out why. Never let schooling interfere with your education or honest curiosity.',
    length: 'short',
    source: 'Mark Twain',
  },
  {
    id: 'short-emerson-01',
    text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment. What lies behind us and what lies before us are tiny matters.',
    length: 'short',
    source: 'Ralph Waldo Emerson',
  },
  {
    id: 'short-original-coastline-01',
    text: 'The coastline shifted every year by a few feet, sometimes more, and the old map on the wall of the lighthouse was now an optimistic fiction that nobody bothered to correct.',
    length: 'short',
  },
  {
    id: 'short-dickinson-01',
    text: 'Hope is the thing with feathers that perches in the soul, and sings the tune without the words, and never stops at all, and sweetest in the gale is heard.',
    length: 'short',
    source: 'Emily Dickinson',
  },
  {
    id: 'short-original-garage-01',
    text: 'Inside the garage there were boxes of tools he had never used, books he meant to read, and a bicycle with a flat tire and a very patient basket waiting by the door.',
    length: 'short',
  },
  {
    id: 'short-confucius-01',
    text: 'It does not matter how slowly you go, so long as you do not stop. Our greatest glory is not in never falling, but in rising every time we fall down.',
    length: 'short',
    source: 'Confucius',
  },

  // --- MEDIUM (30 passages, 40-65 words) ---
  {
    id: 'medium-austen-01',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families that he is considered as rightful property.',
    length: 'medium',
    source: 'Jane Austen',
  },
  {
    id: 'medium-dickens-01',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, the spring of hope, the winter of despair.',
    length: 'medium',
    source: 'Charles Dickens',
  },
  {
    id: 'medium-lincoln-01',
    text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived, can long endure in freedom.',
    length: 'medium',
    source: 'Abraham Lincoln',
  },
  {
    id: 'medium-thoreau-01',
    text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear.',
    length: 'medium',
    source: 'Henry David Thoreau',
  },
  {
    id: 'medium-carroll-01',
    text: 'Alice was beginning to get very tired of sitting by her sister on the bank and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book without pictures or conversations.',
    length: 'medium',
    source: 'Lewis Carroll',
  },
  {
    id: 'medium-melville-01',
    text: 'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.',
    length: 'medium',
    source: 'Herman Melville',
  },
  {
    id: 'medium-aurelius-01',
    text: 'When you arise in the morning, think of what a precious privilege it is to be alive, to breathe, to think, to enjoy, to love. Waste no more time arguing about what a good person should be. Be one. The best revenge is not to be like your enemy, but to be better than the person you were yesterday.',
    length: 'medium',
    source: 'Marcus Aurelius',
  },
  {
    id: 'medium-original-library-01',
    text: 'The library on the corner had been open every evening for as long as anyone could remember, and though most of its shelves were dusty and its catalog slightly out of date, the people who came to sit by its warm windows never seemed to mind, and they always returned the books they borrowed.',
    length: 'medium',
  },
  {
    id: 'medium-emerson-01',
    text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment. Do not go where the path may lead; go instead where there is no path and leave a trail. Nothing great was ever achieved without enthusiasm, and nothing small ever endured without patience.',
    length: 'medium',
    source: 'Ralph Waldo Emerson',
  },
  {
    id: 'medium-twain-01',
    text: 'The two most important days in your life are the day you are born and the day you find out why. Never let schooling interfere with your education. The secret of getting ahead is getting started, and the secret of getting started is breaking your complex overwhelming tasks into small manageable pieces that you can begin immediately.',
    length: 'medium',
    source: 'Mark Twain',
  },
  {
    id: 'medium-kipling-01',
    text: 'If you can keep your head when all about you are losing theirs and blaming it on you, if you can trust yourself when all men doubt you but make allowance for their doubting too, if you can wait and not be tired by waiting, or being lied about, do not deal in lies.',
    length: 'medium',
    source: 'Rudyard Kipling',
  },
  {
    id: 'medium-original-bakery-01',
    text: 'Every morning the bakery on the corner opened at precisely six fifteen. The baker, who had no watch, always arrived on time because he counted the steps from his apartment and knew exactly how many the walk should take. On rare occasions he would stop to look at the clouds, and on those mornings the bread was slightly late.',
    length: 'medium',
  },
  {
    id: 'medium-wilde-01',
    text: 'To live is the rarest thing in the world. Most people exist, that is all. Be yourself, everyone else is already taken. The truth is rarely pure and never simple. We are all in the gutter, but some of us are looking at the stars. I can resist everything except temptation and good conversation.',
    length: 'medium',
    source: 'Oscar Wilde',
  },
  {
    id: 'medium-original-train-01',
    text: 'The train arrived at the small station a few minutes after midnight. Only one passenger stepped off, a quiet woman carrying a battered leather suitcase and a notebook under her arm. She stood on the empty platform for a long moment, looking at the pale lamp above the ticket office, as if making up her mind about something that could not be postponed.',
    length: 'medium',
  },
  {
    id: 'medium-franklin-01',
    text: 'Early to bed and early to rise makes a man healthy, wealthy, and wise. An investment in knowledge pays the best interest. Lost time is never found again. By failing to prepare, you are preparing to fail. Well done is better than well said. He that is good for making excuses is seldom good for anything else.',
    length: 'medium',
    source: 'Benjamin Franklin',
  },
  {
    id: 'medium-original-garden-01',
    text: 'The garden behind the old brick house was not large, but it held a surprising number of things: a bent fig tree, three beds of unruly herbs, a stone bench that rocked slightly on uneven ground, and a wooden gate that never quite closed. Every summer, without asking, it produced more tomatoes than anyone could eat.',
    length: 'medium',
  },
  {
    id: 'medium-emerson-02',
    text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us. Finish each day and be done with it. You have done what you could. Some blunders and absurdities, no doubt, crept in; forget them as soon as you can. Tomorrow is a new day. Begin it well and serenely.',
    length: 'medium',
    source: 'Ralph Waldo Emerson',
  },
  {
    id: 'medium-original-workshop-01',
    text: 'In the workshop on the edge of town there was a carpenter who built chairs so well that people claimed they were inherited rather than purchased. He worked slowly, spoke little, and never advertised. The chairs left his shop two or three at a time, on a small truck driven by his son, and always with a single coat of beeswax.',
    length: 'medium',
  },
  {
    id: 'medium-angelou-01',
    text: 'There is no greater agony than bearing an untold story inside you. You may encounter many defeats, but you must not be defeated. In fact, it may be necessary to encounter the defeats, so you can know who you are, what you can rise from, and how you can still come out of it whole and honest.',
    length: 'medium',
    source: 'Maya Angelou',
  },
  {
    id: 'medium-original-sea-01',
    text: 'The sea that morning was the color of old coins, and the horizon carried a long gray smudge that might have been distant rain or a freighter making its way toward the harbor. Birds circled the rocks in loose formations, complaining to no one in particular, while the wind lifted the sand into small brief spirals along the empty beach.',
    length: 'medium',
  },
  {
    id: 'medium-aristotle-01',
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit. The whole is greater than the sum of its parts. The more you know, the more you realize you do not know. Pleasure in the job puts perfection in the work, and patience is bitter but its fruit is sweet for those who wait.',
    length: 'medium',
    source: 'Aristotle',
  },
  {
    id: 'medium-original-cafe-01',
    text: 'The small cafe by the fountain had only seven tables, a chalkboard menu that rarely changed, and a radio that played softly from behind the counter. Regulars came for the coffee but stayed for the quiet. Tourists passed by without noticing, which suited everyone inside perfectly well, and the owner rarely looked up from his newspaper.',
    length: 'medium',
  },
  {
    id: 'medium-einstein-01',
    text: 'Imagination is more important than knowledge. Knowledge is limited to all we now know and understand, while imagination embraces the entire world, and all there ever will be to know and understand. Logic will get you from A to B, but imagination will take you everywhere. Try not to become a man of success, rather a man of value.',
    length: 'medium',
    source: 'Albert Einstein',
  },
  {
    id: 'medium-original-storm-01',
    text: 'The storm arrived slowly at first, a soft drumming against the roof that could almost be mistaken for the cat upstairs. Then the wind caught the loose shutter, the lamp on the table flickered twice, and the lights went out. In the sudden dark we found each other by voice, and listened as the rain became a great rushing river.',
    length: 'medium',
  },
  {
    id: 'medium-wollstonecraft-01',
    text: 'The beginning is always today. I do not wish women to have power over men, but over themselves. It is time to effect a revolution in female manners, time to restore to them their lost dignity, and make them, as a part of the human species, labor to reform the world by reforming themselves first.',
    length: 'medium',
    source: 'Mary Wollstonecraft',
  },
  {
    id: 'medium-original-bookshop-01',
    text: 'The bookshop was tucked between a tailor and a shoe repair, narrow as a hallway, taller than it was wide. Its single employee, a woman with a careful smile, knew every title on every shelf, and could recommend a book to almost anyone after a short conversation, though she would also happily leave you in peace if you preferred.',
    length: 'medium',
  },
  {
    id: 'medium-carver-01',
    text: 'A writer is someone who pays attention to the world. Writing is not about following rules but about noticing details others miss. Get in, get out. Do not linger. Go on. That is what I learned by paying attention to my own life: it was not the subject I thought it was, and it had better endings than I expected.',
    length: 'medium',
  },
  {
    id: 'medium-original-clockwork-01',
    text: 'The clockmaker kept a small workshop on the second floor of an old building near the river. He was patient in a way that felt almost pre-industrial, taking his time with each piece, listening for the smallest wrong tick. Clocks he had fixed decades ago still came back occasionally, carried by the children of their original owners.',
    length: 'medium',
  },
  {
    id: 'medium-plato-01',
    text: 'The measure of a man is what he does with power. The beginning is the most important part of the work. Wise men speak because they have something to say; fools because they have to say something. At the touch of love everyone becomes a poet, and poetry is nearer to vital truth than history will ever reach.',
    length: 'medium',
    source: 'Plato',
  },
  {
    id: 'medium-original-ferry-01',
    text: 'The ferry crossed the bay twice an hour in summer, once an hour in winter. On foggy mornings you could not see the opposite shore, but the captain knew the route by the sound of the bell and the feel of the current. Passengers arrived on the other side with damp coats and the vague sense of having traveled much further than they had.',
    length: 'medium',
  },

  // --- LONG (10 passages, 85-115 words) ---
  {
    id: 'long-lincoln-01',
    text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battlefield of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.',
    length: 'long',
    source: 'Abraham Lincoln',
  },
  {
    id: 'long-dickens-01',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to heaven, we were all going direct the other way. In short, the period was so far like the present period.',
    length: 'long',
    source: 'Charles Dickens',
  },
  {
    id: 'long-melville-01',
    text: 'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth, whenever it is a damp, drizzly November in my soul, whenever I find myself involuntarily pausing before coffin warehouses, then I account it high time to get to sea as soon as I can.',
    length: 'long',
    source: 'Herman Melville',
  },
  {
    id: 'long-thoreau-01',
    text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practice resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and so spartan-like as to put to rout all that was not life.',
    length: 'long',
    source: 'Henry David Thoreau',
  },
  {
    id: 'long-original-ocean-01',
    text: 'The ocean at five in the morning was a quiet, dark animal that had not yet decided what kind of day to become. She stood at the edge of the pier with her coffee, watching the slow swell move the boats, listening to the ropes creak and the gulls complain somewhere in the fog. Someone had left a newspaper folded on the bench. She read the first headline without curiosity, then folded it again and walked on, her footsteps loud on the wet planks, the lighthouse at the end of the pier still blinking out its patient, private message.',
    length: 'long',
  },
  {
    id: 'long-austen-01',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters. My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield Park is let at last? Mr. Bennet replied that he had not.',
    length: 'long',
    source: 'Jane Austen',
  },
  {
    id: 'long-original-mountain-01',
    text: 'The mountain village had one road in and one road out, and between them a dozen stone houses, a small church, a tavern, a school with two rooms, and a shop that sold everything from flour to fishing line. In winter the road out was often closed by snow, and in summer the road in brought more visitors than the village could comfortably hold. The villagers had adapted to both extremes with the same patient shrug, knowing that whatever came with the season would eventually leave, and that the mountain itself would remain, quiet and indifferent.',
    length: 'long',
  },
  {
    id: 'long-carroll-01',
    text: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations. So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy chain would be worth the trouble of getting up and picking the daisies.',
    length: 'long',
    source: 'Lewis Carroll',
  },
  {
    id: 'long-original-workshop-01',
    text: 'The old typewriter on the desk in the corner of the workshop had belonged to his grandfather, then to his mother, and now to him. The ribbon was new, the keys were cleaned each year, and the little bell that rang at the end of each line still worked, though faintly, as if embarrassed by its own remaining persistence. On weekends he typed letters to people he would probably never send them to, just to hear the sound, and to feel the small, definite resistance of each key giving way under his fingers, and the quiet satisfaction of words becoming paper.',
    length: 'long',
  },
  {
    id: 'long-original-river-01',
    text: 'The river ran past the town for seven miles, sometimes wide and slow, sometimes narrow and fast, and on one bend it had cut into the bank so deeply that an old oak had eventually given up and fallen across the water, forming a bridge no one used but everyone agreed was useful in principle. Children fished from it in summer. In autumn, leaves piled on its trunk and drifted off in flotillas. In winter, when the river froze at the edges, the oak became a frosted beam of memory stretching from one quiet shore to the other.',
    length: 'long',
  },
];
