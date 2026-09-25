import type { BirthdayContent } from '../birthday/types';

/**
 * THE one place for all of Dheepika's content (rendering components never hard-code it).
 *
 * Shipped content: every line of feeling is written (edit any of it freely). Only facts that
 * can't be invented stay bracketed: dates, places, song titles, photos, videos and the voice
 * note. Nothing here claims a specific shared memory.
 * Real content goes in `birthday-private/content.json` (same shape, git‑ignored) and is
 * encrypted into the site with `npm run vault` (see docs/CONTENT_GUIDE.md).
 */
const P = (s: string) => `[${s}]`;

export const PLACEHOLDER: BirthdayContent = {
  placeholder: true,
  name: 'Dheepika',
  date: '25 · 11',
  birthday: { month: 11, day: 25, timezone: '', countdownEnabled: false },
  opening: { lines: ['Some dates are just dates.', 'But one changed my world.'], enter: 'Enter our garden', shootingStar: 'Make a wish ✦' },
  threshold: { lines: ['A garden', 'made of', 'memories'], copy: ['Every flower here holds a little of us.', 'Scroll slowly. Touch whatever glows.'] },
  signature: 'Always yours',
  lanternWishes: [
    'More reasons to laugh.',
    'More places to discover.',
    'More peaceful mornings.',
    'More dreams becoming real.',
    'Courage on the days you need it.',
    'Rest on the days you don’t.',
    'People who see you the way I do.',
    'A year that is gentle with you.',
    'Late talks that end in laughter.',
    'Every little plan working out.',
    'Someone always saving you the window seat.',
    'Me, still beside you, a year from now.',
  ],
  finalWords: ['Another year of you.', 'Another year of memories waiting to happen.', 'Happy birthday, Dheepika.'],
  futurePrompt: 'Write something we should read together next year.',
  beginning: { line: 'The day my favourite person entered this world.' },
  // captions are written to sit under any photo; add the real date and place with each photo
  memories: [
    'One of the days I keep replaying.',
    'I didn’t know then how much this would matter.',
    'Your laugh, right before this was taken.',
    'Proof that ordinary days with you are the best ones.',
    'I remember exactly how this moment felt.',
    'You, being completely yourself. My favourite view.',
    'A small moment that turned into a big memory.',
    'If I could live one day again, it might be this one.',
  ].map((caption) => ({ caption, date: P('date'), place: P('place') })),
  polaroidPrompt: 'Press the shutter.',
  puzzle: { caption: 'Some pieces only make sense together. Like us.' },
  letter: {
    greeting: 'Dear Dheepika,',
    paragraphs: [
      'There are things I think about you every day and somehow never say out loud. So I built you a garden, and I’m saying them here.',
      'You make ordinary days feel like something worth remembering. You make me laugh when I least expect it, you listen when I don’t make sense, and you stay kind even when the world isn’t.',
      'I don’t know everything this year will bring. But I know I want to be there for the good days and the hard ones, for the small plans and the big dreams, for all of it.',
      'Thank you for being exactly who you are. I wouldn’t change a single thing, except maybe how many birthdays I get to spend with you. More, please.',
    ],
    signoff: 'Happy birthday. Yours,',
  },
  reasons: [
    'Your smile: it changes the whole room, and it still catches me off guard.',
    'Your laugh: it’s my favourite sound, and I’ll do silly things just to hear it.',
    'Your kindness: you’re gentle with people even when nobody is watching.',
    'Your angry face: honestly, it’s too cute to take seriously, and you know it.',
    'Your craziness: life with you is never boring, not even for a minute.',
    'Your voice: some days, it’s the only thing that makes everything feel okay.',
    'The way you support me: you believe in me on days I don’t believe in myself.',
    'Your little habits: the small things you do without noticing are the ones I notice most.',
    'Your honesty: you tell me the truth, even when a softer answer would be easier.',
    'Your strength: you carry more than you let anyone see, and you still show up.',
    'Your curiosity: you make me want to see the world with new eyes.',
    'Your heart: the way you care, fully and without holding back.',
    'The way you say my name: somehow it sounds different when you say it.',
    'Simply you: all of you, exactly as you are. That’s the fourteenth reason and the first.',
  ],
  nameLetters: [
    'D is for the Dreams I want to chase with you.',
    'H is for the way you make anywhere feel like Home.',
    'E is for Every day I choose you, again.',
    'E is for Endless talks that never feel long enough.',
    'P is for the Patience you show me more than I deserve.',
    'I is for the Inside jokes nobody else will ever get.',
    'K is for your Kindness, the kind that changes people.',
    'A is for Always, which is how long I mean all of this.',
  ],
  game: { finish: 'But you already caught my heart.' },
  quiz: [
    {
      q: 'What do I love doing with you most?',
      options: ['Talking for hours', 'Doing absolutely nothing together', 'All of the above, obviously'],
      answer: 2,
      yes: 'Exactly. Anything, as long as it’s with you. 🥹',
      no: 'Close… but the real answer is: all of it.',
    },
    {
      q: 'When do I miss you the most?',
      options: ['Late at night', 'When something funny happens', 'Pretty much always'],
      answer: 2,
      yes: 'You know me too well. 💛',
      no: 'That too. But honestly? Pretty much always.',
    },
    {
      q: 'What do you think I noticed first about you?',
      options: ['Your smile', 'Your eyes', 'The way you talk'],
      answer: null,
      yes: 'Good guess. Ask me in person and I’ll tell you the whole story.',
      no: 'Good guess. Ask me in person and I’ll tell you the whole story.',
    },
  ],
  thisOrThat: [
    ['Beach', 'Mountains'],
    ['Movie', 'Long drive'],
    ['Hugs', 'Kisses'],
    ['Morning', 'Night'],
    ['Planned trip', 'Random adventure'],
  ],
  // the clues are answered from the garden itself, so nothing here needs a shared secret
  secret: {
    intro: 'Answer each clue to reveal one symbol of the code. Everything you need is somewhere in this little universe.',
    clues: [
      { clue: 'How many tulips grow in this garden? Only the first digit, please.', answers: ['2', 'two', '25', 'twenty five', 'twentyfive'], symbol: '2' },
      { clue: 'Count the tulips again. What is the last digit?', answers: ['5', 'five'], symbol: '5' },
      { clue: 'What shape holds the letter D on the very first screen?', answers: ['heart', 'a heart', 'love heart'], symbol: '♥' },
      { clue: 'In 25 · 11, which number is the month?', answers: ['11', 'eleven', 'november'], symbol: '1' },
      { clue: 'The month once more. What is its last digit?', answers: ['1', 'one'], symbol: '1' },
    ],
    reveal: { text: '25 ♥ 11. The code was your birthday all along, because that’s the day everything good started.' },
  },
  songs: Array.from({ length: 5 }, (_, i) => ({
    title: P(`Song ${i + 1} title`),
    artist: P('artist'),
    note: [
      'The one that plays in my head when I think of you.',
      'The song that feels like a long drive with you.',
      'The one I’d play for you at midnight.',
      'The song that sounds like a good day.',
      'The one I can never listen to without smiling.',
    ][i],
  })),
  // your dates and words (the full, uncut version lives in birthday-private/ for the vault)
  timelineStory: {
    intro: 'Sometimes I sit quietly and think about how our love actually began… and suddenly all those dates come alive in my mind like a movie.',
    outro: 'Every single date you gave me is not just a memory… it’s a piece of my heart that you are carrying.\nAnd when I think of all these moments, I just feel one thing clearly.\nYou are not just a chapter in my story, Dheepika… 💚 you are the whole book ♾️',
  },
  timeline: [
    { label: 'The beginning', date: '23 October', text: 'The day our story slowly started writing itself, even though neither of us realised how deep we would fall.' },
    { label: 'First meet, first kiss', date: '30 October', text: 'Our first meet and first kiss. Those late texts where we both acted normal, but inside something in us had already changed… something had already chosen each other.' },
    { label: '“I love you”', date: '31 October', text: 'The day I surprised you. You kissed me and whispered “I love you” against my lips.\nThat single moment still feels like it is carved into my chest. I didn’t just hear it, I felt it.' },
    { label: 'Ooty', date: '2 November', text: 'Ooty… our first trip together. A trip filled with love, fear, excitement, innocence, and a kind of closeness I didn’t even know I was capable of feeling.\nThat day changed something in both of us, deep inside our hearts.' },
    { label: 'Your day', date: '25 November', text: 'Your day. I can never forget it.\nA day that started painfully, but ended with tears… not the sad ones, the ones that come only when someone matters too much.\nThat day taught me that even our fights have love inside them.' },
    { label: 'The rain', date: '29 November', text: 'The shopping, the gifts, the rain… and that moment where we pulled each other close because the world around us became too cold.\nI still remember your warmth in that rain, like something only you can give me.' },
    { label: 'The lake', date: '30 November', text: 'We laughed on the pedal boat, enjoying the lake. Your hair clip moment still makes me smile 😂\nAnd the way we held each other and trusted each other… that memory will always feel special to me.' },
    { label: 'Two souls', date: '11 & 12 December', text: 'Those late night moments where we were both too shy to admit how much we wanted each other.\nYou made me feel wanted, not just in the moment, but in my heart. Those days weren’t just passion, they were two souls craving each other.' },
  ],
  emptyFrame: 'Next memory goes here.',
  gifts: [
    { label: 'I', kind: 'message', text: 'You are the best thing that has happened to me, and I don’t say it enough. So here it is, in a box, where you can find it any time.' },
    { label: 'II', kind: 'promise', text: 'I promise to listen, even when I think I already know. To show up, even on the hard days. And to keep making you laugh.' },
    { label: 'III', kind: 'promise', text: 'One whole day, planned entirely by you. Wherever, whatever. I’ll say yes to all of it.' },
  ],
  wish: { line: 'I hope this one comes true.' },
  future: [
    { title: 'A place we should visit', text: 'Somewhere with a sky this full of stars.' },
    { title: 'Something we should try', text: 'Something neither of us has ever done, so we can be bad at it together.' },
    { title: "A photo we haven't taken yet", text: 'The two of us, laughing too hard to look at the camera.' },
    { title: 'A midnight adventure', text: 'No plan, a full tank, and a playlist we both pretend to hate.' },
    { title: 'One dream for us', text: 'A life where every ordinary day still feels a little like this garden.' },
  ],
  manor: {
    kicker: 'Someday',
    title: 'A home with a garden',
    line: 'Tall windows full of morning light, a path lined with blossoms, and a door that is always open for the two of us.',
  },
  wishes: [
    'A year full of reasons to smile.',
    'Mornings that start slow and soft.',
    'Good news arriving when you least expect it.',
    'Every plan you make working out.',
    'Friends who feel like home.',
    'A new place that steals your heart.',
    'Health, rest, and gentle days.',
    'Courage for every new beginning.',
    'Laughter until your cheeks hurt.',
    'Dreams that start coming true.',
    'Quiet evenings that feel like a hug.',
    'Music that finds you at the right moment.',
    'Kindness coming back to you, tenfold.',
    'Confidence in everything you are.',
    'Adventures, big and small.',
    'A reason to dance in the kitchen.',
    'People who make you feel understood.',
    'Peace on the difficult days.',
    'Surprises that make you gasp.',
    'Time for the things you love.',
    'Growth that feels exciting, not heavy.',
    'Moments you’ll want to remember forever.',
    'Love that feels safe and easy.',
    'And me, cheering for you through all of it.',
  ],
  movie: { clips: [], line: 'Different days. Different places. Same person I keep choosing.' },
  finale: {
    // HAPPY BIRTHDAY itself is saved for the sky at the very end
    headline: 'Every flower here is yours.',
    lastThing:
      'If you’ve come all the way here, through the garden, past the cake and up into the sky, then you already know. But I’ll say it anyway. You are my favourite part of every day. Thank you for being born, and thank you for letting me be part of your story. Here’s to this year, and every one after it.',
    secretEnding:
      'You found every hidden heart. Of course you did: you notice the small things, the same way you noticed me. This is the last secret: every heart in this garden was always yours.',
  },
};
