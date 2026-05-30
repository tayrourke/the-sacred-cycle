// ═══════════════════════════════════════════
// DATA — AFFIRMATIONS
// ═══════════════════════════════════════════
var AFFIRMATIONS = {
  menstrual: [
    'Rest is not laziness — it is how you refill what you pour into everything else.',
    'Your body is doing sacred, invisible work. Honor it fully.',
    'You are allowed to need less today. That is not failing — that is wisdom.',
    'The most powerful thing you can do right now is slow all the way down.',
    'This is a season of release. Let what needs to go, go.',
    'You don\'t have to earn your rest. It has always belonged to you.',
    'Something is completing itself in you right now. Trust the process.',
    'Turning inward is not retreating — it\'s recalibrating.',
    'Your worth is not tied to your output. Not today, not ever.',
    'Even the moon goes completely dark before she glows again.'
  ],
  follicular: [
    'Your energy is waking up. Meet it with curiosity, not pressure.',
    'New ideas are moving through you. Give them somewhere to land.',
    'This is your season to begin. Start the thing you\'ve been circling.',
    'Your mind is sharp and your body is light. Trust both.',
    'Plant seeds today that you\'ll harvest at ovulation.',
    'The spark you feel right now is not random — it\'s a signal. Follow it.',
    'Creativity is flowing. Clear the runway and let it move through you.',
    'You are in your rising. So much is possible from right here.',
    'This phase was made for bold first moves. Make one.',
    'Trust the ideas that light you up — they are not accidents.'
  ],
  ovulatory: [
    'You are magnetic right now. Show up like you already know it.',
    'This is your moment to speak, share, and be fully seen. Take it.',
    'The world genuinely benefits when you take up space. Don\'t shrink.',
    'Your confidence right now is biology — let it carry you forward.',
    'You were made to bloom. This is that exact season.',
    'Get on camera. Be seen. Your presence is one of your greatest gifts.',
    'People are drawn to you right now. Say the thing you\'ve been holding back.',
    'This is not the time to play small. Expand into every room you enter.',
    'Your light is turned all the way up. Don\'t dim it for anyone.',
    'Lead with your voice — it is one of the most powerful things you own.'
  ],
  luteal: [
    'Your discernment right now is a superpower. Trust every bit of it.',
    'Not everything deserves a yes. Protecting your energy is an act of self-respect.',
    'You are completing a cycle. Finish what matters and release the rest.',
    'Your sensitivity is data, not weakness. Listen to it.',
    'This phase asks for depth, not breadth. Go slow and go thorough.',
    'The things bothering you right now are pointing at something real. Pay attention.',
    'Honor the quieting. Solitude in this phase is deeply productive.',
    'You don\'t have to respond to everything. Choose what gets your energy.',
    'Completion is its own kind of magic. Tie up the threads.',
    'Rest and output can coexist beautifully. You are allowed both.'
  ]
};

var TASK_SETS = {
  'content creator': {
    menstrual:  ['answer DMs and saved replies','repurpose content into stories','review analytics','brainstorm ideas — no pressure to execute','reply to emails gently','review + update affiliate links'],
    follicular: ['batch-write captions for the week','draft a newsletter or email','brainstorm a new content series','outline a new reel concept','reply to brand inquiry emails','plan your content batch day'],
    ovulatory:  ['film reels — you are magnetic right now','record voiceovers and talking-head content','pitch a brand collab','go live or show up on camera','record a tutorial or educational reel','film a day-in-the-life'],
    luteal:     ['edit and schedule content already filmed','finalize captions and hashtags','organize your content calendar','build out a new affiliate collection','write and refine an offer or sales page']
  },
  'homeschool / stay at home': {
    menstrual:  ['lighter homeschool day — audiobooks and documentaries','rest while kids have independent time','gentle meal planning','read-aloud or quiet activities only','skip non-essential errands'],
    follicular: ['plan the homeschool week ahead','introduce a new unit or project','tackle a home organization project','schedule playdates or co-op days','prep learning materials'],
    ovulatory:  ['field trip or experiential learning day','collaborative projects with the kids','connect with other homeschool families','teach something new — your energy is high','record memories or document the kids'],
    luteal:     ['finish and review current unit','prep meals in advance','organize learning spaces','complete paperwork or portfolios','wrap up household tasks before the new cycle']
  },
  'office / corporate': {
    menstrual:  ['respond to existing emails — no new projects','review documents and give feedback','attend scheduled meetings only','administrative tasks that need less thought','delegate where possible'],
    follicular: ['tackle complex projects requiring focus','learn a new skill or take a course','draft proposals or strategic documents','schedule important meetings for ovulatory week','brainstorm solutions'],
    ovulatory:  ['lead meetings and presentations','have difficult conversations or negotiations','pitch ideas to leadership','network and collaborate','give feedback and mentor others'],
    luteal:     ['complete and close out open projects','review budgets and reports','organize files and systems','detail-oriented work without socializing needed','prep handoffs and wrap-ups']
  },
  'general / everyday life': {
    menstrual:  ['rest and protect your energy','cancel non-essential commitments','journal or reflect on the past month','nourishing cooking or meal prep','gentle self-care — bath, early bedtime'],
    follicular: ['tackle your to-do list backlog','start a project you have been putting off','make a plan or set intentions for the month','declutter one area of your home','learn something new'],
    ovulatory:  ['have important conversations','make big decisions','connect with friends or family','schedule your most demanding tasks','put yourself out there in some way'],
    luteal:     ['finish what you started','deep clean or organize your home','review your finances or budget','prep and plan for the upcoming week','wrap up loose ends before your period']
  }
};

function getTaskSet() {
  var sets = null;
  if (appState.profile && appState.profile.task_sets) {
    try { sets = typeof appState.profile.task_sets === 'string' ? JSON.parse(appState.profile.task_sets) : appState.profile.task_sets; } catch(e){}
  }
  if (!sets || !sets.length) {
    var s = (appState.profile && appState.profile.task_set) || 'general / everyday life';
    sets = [s];
  }
  var merged = { menstrual:[], follicular:[], ovulatory:[], luteal:[] };
  sets.forEach(function(s) {
    var ts = TASK_SETS[s] || TASK_SETS['general / everyday life'];
    ['menstrual','follicular','ovulatory','luteal'].forEach(function(ph){
      (ts[ph]||[]).forEach(function(t){ if(merged[ph].indexOf(t)===-1) merged[ph].push(t); });
    });
  });
  return merged;
}

var DEFAULT_TASKS = {
  menstrual: ['answer dms and saved replies','repurpose content into stories','review last month\'s analytics','brainstorm ideas — no pressure to execute','reply to emails at a gentle pace','review + update affiliate links'],
  follicular: ['batch-write captions for the week','draft an email or newsletter','brainstorm a new content series','write carousel copy','outline a new reel concept','reply to brand inquiry emails','plan your next content batch day'],
  ovulatory: ['film reels — you\'re magnetic right now','record voiceovers and talking-head content','pitch a brand collab or respond to partnerships','go live or show up on camera in stories','record a tutorial or educational reel','create a product walkthrough or haul video','film a day-in-the-life or behind-the-scenes'],
  luteal: ['edit and schedule content already filmed','finalize captions and hashtag strategy','deep-work on cookbook writing or recipe notes','organize your content calendar','build out a new affiliate collection','write and refine an offer or sales page','audit partnership follow-ups']
};

var DEFAULT_MOOD_EMOJIS = [
  {emoji:'🫠',label:'overwhelmed'},{emoji:'🧹',label:'cleaning mode'},{emoji:'🔮',label:'intuitive'},{emoji:'🍞',label:'nesting'},
  {emoji:'📚',label:'homeschool brain'},{emoji:'🌪️',label:'chaotic but okay'},{emoji:'🐺',label:'feral/unhinged'},{emoji:'🦋',label:'transforming'},
  {emoji:'💸',label:'hustle mode'},{emoji:'🫶',label:'full heart'},{emoji:'😌',label:'calm'},{emoji:'😔',label:'low'},
  {emoji:'✨',label:'energized'},{emoji:'🌙',label:'dreamy'},{emoji:'🥰',label:'loving life'}
];

var DEFAULT_MOOD_WORDS = ['grateful','grounded','sensitive','creative','foggy','hopeful','irritable','anxious','rested','depleted','inspired','tender','focused','scattered','radiant','melancholy','playful','peaceful'];

var DEFAULT_SYMPTOMS = {
  general: [
    {name:'bloating',emoji:'💨'},{name:'headache',emoji:'💫'},
    {name:'cravings',emoji:'🍫'},{name:'skin/breakouts',emoji:'✨'},{name:'constipated',emoji:'🪨'},{name:'diarrhea',emoji:'💧'}
  ],
  menstrual: [
    {name:'cramps',emoji:'🩸'},{name:'heavy flow',emoji:'🩸'},{name:'clots',emoji:'🔴'},
    {name:'lower back pain',emoji:'💢'},{name:'fatigue',emoji:'🕯️'}
  ],
  follicular: [
    {name:'increased energy',emoji:'🌱'},{name:'restless energy',emoji:'⚡'},{name:'cervical mucus starting',emoji:'💦'},
    {name:'skin clearing',emoji:'✨'},{name:'light spotting',emoji:'🌸'}
  ],
  ovulatory: [
    {name:'ovulation pain/mittelschmerz',emoji:'⚡'},{name:'clear watery discharge',emoji:'💦'},
    {name:'egg white cervical mucus (ewcm)',emoji:'🥚'},{name:'creamy/lotiony discharge',emoji:'🤍'},
    {name:'breast tenderness',emoji:'🌸'},{name:'increased libido',emoji:'🌹'}
  ],
  luteal: [
    {name:'pms mood swings',emoji:'🌊'},{name:'anxiety/irritability',emoji:'🔥'},
    {name:'lower back pain',emoji:'💢'},{name:'brain fog',emoji:'☁️'}
  ]
};

// ═══════════════════════════════════════════
// SUPPORT DATA
// ═══════════════════════════════════════════
var SUPPORT_DATA = {
  menstrual: {
    foods: [
      {name:'🩸 beets',why:'Rich in iron and folate to replenish what\'s lost during menstruation. The deep pigment (betalains) also reduce inflammation and support liver detoxification of used hormones.'},
      {name:'🥬 dark leafy greens',why:'Spinach, kale, and chard replenish iron and magnesium — two minerals critically depleted during the bleed. Vitamin K in greens also supports healthy clotting.'},
      {name:'🐟 wild salmon',why:'Omega-3 fatty acids (EPA and DHA) directly reduce prostaglandin production — the inflammatory compounds that cause uterine cramping. One of the most evidence-backed foods for period pain.'},
      {name:'🌰 walnuts',why:'Plant-based omega-3s (ALA) reduce overall inflammation. Also rich in magnesium, which relaxes smooth muscle — including the uterus.'},
      {name:'🍫 dark chocolate (85%+)',why:'One of the highest food sources of magnesium. Magnesium supports muscle relaxation, improves mood via serotonin pathways, and eases the cramping that comes from muscle tension. Choose low-sugar varieties.'},
      {name:'🍖 bone broth',why:'Deeply nourishing and mineral-rich. Glycine from collagen supports the gut lining (which becomes more permeable during the bleed), and the mineral profile replenishes what\'s lost in blood.'},
      {name:'🫚 ginger',why:'Clinically studied for menstrual pain — studies show it can be as effective as ibuprofen for reducing cramp severity when taken consistently. Reduces prostaglandins and warms the lower abdomen.'},
      {name:'🫘 kidney beans',why:'Excellent plant-based iron and protein for sustained energy during the energy-depleted menstrual phase. Pair with vitamin C foods to enhance iron absorption.'},
      {name:'🍠 sweet potato',why:'Complex carbohydrates stabilize blood sugar and reduce carb cravings. Rich in B6 and potassium, which ease muscle cramping and mood dips.'},
      {name:'🌿 turmeric golden milk',why:'Curcumin is one of the most well-researched anti-inflammatory compounds in nature. Specifically reduces prostaglandin-driven menstrual pain and systemic inflammation. Best absorbed with black pepper and fat.'}
    ],
    teas: [
      {name:'🍵 raspberry leaf',why:'The most famous women\'s herb — tones and strengthens the uterine muscle over time. Best taken consistently throughout the cycle rather than just during menstruation. May reduce cramping and heavy flow over several cycles.'},
      {name:'🌿 ginger root',why:'Potent anti-inflammatory and antispasmodic. Reduces nausea that sometimes accompanies heavy periods and directly counteracts prostaglandin-driven cramping. Brew fresh sliced ginger for maximum potency.'},
      {name:'🌼 chamomile',why:'Contains apigenin, which has antispasmodic properties that relax smooth muscle — including the uterus. Studies show consistent chamomile consumption reduces menstrual cramping. Also calms the nervous system and improves sleep.'},
      {name:'🌲 cramp bark',why:'Named for exactly what it does. The bark of Viburnum opulus has been used for centuries specifically for uterine muscle spasms. One of the most targeted natural antispasmodics for period cramping.'},
      {name:'🌱 nettle',why:'One of the most iron-rich herbs available — significantly supports mineral replenishment during blood loss. Also high in calcium, magnesium, and vitamin K. Best drunk 2–3x daily during menstruation.'}
    ],
    supplements: [
      {name:'💊 magnesium glycinate 200–320mg',why:'The single most impactful supplement for the menstrual phase. Relaxes uterine smooth muscle to reduce cramping, supports GABA for sleep, reduces cortisol, and eases the mood instability that comes from progesterone withdrawal.'},
      {name:'🐟 omega-3 fish oil 2–3g EPA/DHA',why:'Clinical studies show omega-3 supplementation reduces menstrual pain by lowering prostaglandin production. Take with food to improve absorption and reduce fishy reflux.'},
      {name:'☀️ vitamin D3 + K2',why:'Low vitamin D is associated with more severe menstrual pain and heavier periods. K2 works synergistically with D3 to support calcium metabolism. Take with a fat-containing meal for best absorption.'},
      {name:'⚡ B-complex',why:'B vitamins — especially B1 (thiamine) and B6 — reduce menstrual pain and fatigue. B12 supports energy during blood loss. B3 (niacin) is particularly effective for cramping when taken right before and during day 1-2.'}
    ],
    body: ['🧘 restorative yoga or yin yoga — poses like child\'s pose and reclined butterfly directly ease pelvic tension','🌡️ castor oil pack over lower abdomen — deeply soothing and anti-inflammatory. castor oil contains ricinoleic acid which inhibits prostaglandin production and increases local circulation in the pelvic bowl. important caution: castor oil is an emmenagogue — it can stimulate uterine contractions and increase menstrual flow. this is not inherently harmful and can help the uterus clear more fully, but if your flow is already heavy, start with 20–30 min only and see how your body responds. avoid during pregnancy or if you suspect pregnancy','💆 heating pad with essential oils — apply lavender + clary sage diluted in a carrier oil to the lower abdomen before placing the heat. clary sage contains sclareol, which mimics the relaxing effect of estrogen on smooth muscle. lavender activates GABA receptors, reducing both pain perception and the anxiety that amplifies cramp sensation. heat itself is clinically proven to inhibit pain signal transmission — studies show consistent heat application is as effective as ibuprofen for period pain','🛁 salt bath with magnesium flakes — transdermal magnesium absorption through the skin for muscle relaxation','🌿 slow walking in nature — gentle circulation without depletion','✋ self-massage with warm sesame oil over the lower belly and sacrum — in Ayurvedic medicine, sesame oil is warming and grounding for the nervous system. the heat and manual pressure together increase local circulation, relax the iliopsoas and pelvic floor muscles, and stimulate the vagus nerve through abdominal touch — which reduces the cortisol-driven prostaglandin overproduction behind cramping. use slow, clockwise circular strokes following the direction of the colon','😴 extra sleep without apology — this is when your body is doing the most regenerative work',
'🌿 yoni steam (post-bleed) — yoni steaming is a traditional herbal womb-warming practice. it is only appropriate AFTER bleeding has fully stopped — never during active flow, even light spotting, as steam can increase circulation and worsen bleeding. once your period has fully ended (typically day 5-7), a gentle steam supports uterine clearing, eases residual cramping, and transitions the body into the follicular phase. recommended herbs for post-bleed steaming: rose petals (gentle, tonifying, and emotionally supportive — safe for sensitive tissue), lavender (calming, antimicrobial, and helps with any residual tenderness), calendula (deeply soothing and anti-inflammatory for pelvic tissue), chamomile (antispasmodic, eases the last of any cramping, and calming to the nervous system). note on mugwort: mugwort is stimulating and emmenagogic — it can trigger or increase uterine contractions. it is NOT recommended immediately post-bleed when the uterus is still sensitive. use it only if your period has fully ended for at least 1-2 days and you have no history of heavy periods. how to: steep dried herbs in a covered pot of just-boiled water for 10 min, let steam reduce to warm (not hot), sit undressed from the waist down over the pot for 10-20 min. always test steam temperature on your inner wrist first — if it feels too hot for your wrist, it is too hot for your yoni. contraindications: do not steam if pregnant, trying to conceive in your fertile window, if you have an active vaginal or pelvic infection, open sores, if you have an IUD, or during any bleeding',
'✨ skincare this phase: your skin needs deep hydration and barrier repair right now. low estrogen means your skin produces less natural oil, loses moisture faster, and is more reactive to irritants — this is why your complexion looks dull and feels tight or flaky around your period. what your skin needs: moisture-locking ingredients and gentle support, nothing stripping. toxin free products to look for: ingredients like ceramides, sodium hyaluronate, squalane, and aloe vera — these replenish lipids and attract water into the skin without clogging pores. a fragrance-free facial oil (rosehip seed, marula, or sea buckthorn) added over your moisturizer seals everything in. avoid retinoids, AHAs, BHAs, and alcohol-based toners this week — your barrier is too thin. for period breakouts: caused by the progesterone drop, not bacteria — reach for a willow bark extract spot treatment rather than harsh benzoyl peroxide'],
    movement: ['🧘 gentle stretching or restorative yoga','🚶 slow walking — 20–30 min is plenty','💃 dancing slowly to music you love — movement as medicine without effort','🛌 nothing at all — rest is valid, sacred, and exactly what this phase asks for'],
    work: DEFAULT_TASKS.menstrual,
    avoid_foods: [
      {name:'🍷 alcohol',why:'A double threat during menstruation: dehydrates the body (worsening cramps and fatigue) and disrupts hormonal balance by taxing the liver. Also depletes magnesium and B vitamins — the very nutrients that ease period symptoms.'},
      {name:'☕ caffeine',why:'Constricts blood vessels, which directly worsens cramping and breast tenderness. Also elevates cortisol, which competes with the rest-and-restore signal of menstruation. If you can\'t quit it, switch to half-caf or matcha.'},
      {name:'🍬 refined sugar',why:'Causes rapid blood sugar spikes followed by crashes — amplifying mood instability, fatigue, and cravings. Feeds the inflammatory cycle that drives prostaglandin production.'},
      {name:'🛒 processed foods + seed oils',why:'Pro-inflammatory oils (canola, soybean, sunflower) promote prostaglandin activity and worsen cramping. Processed foods are also high in sodium, increasing water retention and bloating.'},
      {name:'🧊 iced drinks',why:'Traditional Chinese and Ayurvedic medicine both caution against cold during menstruation. Cold is believed to slow healthy blood flow and contract the uterus further. Warm drinks support flow and ease.'}
    ],
    avoid_lifestyle: ['🎉 overcommitting to social events — your social battery is genuinely lower right now, not a personality flaw','💪 high-intensity workouts that deplete rather than restore','⏰ pushing through fatigue as if rest is laziness — rest IS the work this phase','🤔 making major decisions under physical and emotional stress — your discernment is sharp but your bandwidth is low','📵 ignoring your body\'s signals; every symptom is communication worth listening to']
  },
  follicular: {
    foods: [
      {name:'🥚 eggs',why:'The choline in eggs supports liver detox of used estrogens and the brain-gut axis. The fat-soluble vitamins (A, D, E, K) support hormonal synthesis as estrogen begins its climb.'},
      {name:'🥒 fermented foods',why:'Sauerkraut, kimchi, and natural yogurt support the estrobolome — the gut bacteria specifically responsible for estrogen metabolism. A healthy gut microbiome is essential for optimal estrogen recycling and clearance.'},
      {name:'🌾 flaxseeds',why:'The richest plant source of lignans — phytoestrogens that modulate estrogen activity at receptor sites. They support a gentle, healthy rise in estrogen without creating excess. Best ground and consumed fresh.'},
      {name:'🥦 broccoli sprouts',why:'Extraordinarily high in sulforaphane — a compound that activates the liver\'s Phase II detoxification pathways to clear excess and used estrogens. 1 tablespoon of sprouts has more sulforaphane than a full head of broccoli.'},
      {name:'🫘 lentils',why:'Excellent source of folate, which is essential for follicle development and healthy cell division. Protein and iron from lentils also support the building energy of this phase.'},
      {name:'🎃 pumpkin seeds',why:'The highest seed source of zinc — critical for follicle development, egg quality, and progesterone receptor sensitivity. Also high in magnesium and iron. A handful daily supports follicular health throughout this phase.'},
      {name:'🍊 citrus fruits',why:'Vitamin C enhances non-heme iron absorption (critical if iron was depleted during menstruation), supports collagen synthesis in the follicle, and provides antioxidant protection as the dominant follicle develops.'},
      {name:'🥑 avocado',why:'Healthy monounsaturated fats are building blocks for hormone synthesis. Avocado specifically provides beta-sitosterol, which supports healthy cholesterol metabolism — the direct precursor to all sex hormones.'},
      {name:'🐟 wild salmon',why:'DHA (omega-3) supports egg membrane quality and hormone signaling. The anti-inflammatory effect protects the developing follicle from oxidative stress during a period of rapid cell division.'},
      {name:'🌱 sprouts and microgreens',why:'Enzyme-rich and packed with phytonutrients that support hormonal detox pathways. Particularly rich in glucosinolates (like broccoli sprouts) that support liver function and healthy estrogen processing.'}
    ],
    teas: [
      {name:'🍵 green tea',why:'Rich in EGCG and other antioxidants that protect the developing follicle from oxidative stress. Contains L-theanine for calm, focused energy — perfectly matched to follicular clarity. The mild caffeine supports rising energy without cortisol spikes.'},
      {name:'🌿 dandelion root',why:'One of the best liver-supporting herbs available. The liver is responsible for metabolizing and clearing used estrogens — supporting it in the follicular phase ensures a clean, healthy estrogen rise without accumulation or dominance.'},
      {name:'🌸 red clover',why:'Contains phytoestrogens (isoflavones) that gently support the rising estrogen environment. Best used in the early follicular phase when estrogen is building rather than at peak.'},
      {name:'🌼 lemon balm',why:'Calms the nervous system while energy begins to stir. If the transition from menstrual rest to follicular momentum feels jarring, lemon balm bridges the gap with gentle uplift and nervous system support.'}
    ],
    supplements: [
      {name:'💊 vitamin B6 25–50mg',why:'B6 is essential for the production of progesterone from its precursor and helps the liver metabolize estrogens properly. It also supports serotonin and dopamine synthesis — contributing to the characteristically bright mood of this phase.'},
      {name:'🔬 zinc 15–25mg',why:'The most critical trace mineral for folliculogenesis (follicle development). Zinc deficiency directly impairs egg quality. Also supports immune function and skin clarity — which tends to improve naturally in follicular.'},
      {name:'⚡ CoQ10 200–400mg',why:'Mitochondrial energy production is especially important in the follicular phase as the dominant follicle undergoes rapid cell division. CoQ10 is the most evidence-backed supplement for egg quality and fertility outcomes.'},
      {name:'🌿 maca (1–2 tsp in smoothie)',why:'An adaptogenic root that has been shown to support estrogen balance, energy, and libido in the follicular phase. Look for gelatinized maca (easier to digest). Skip if pregnant or on hormonal medications.'}
    ],
    body: ['🫧 lymphatic massage before showering — use firm upward strokes toward the heart, always stroking toward the heart. the lymphatic system has no pump and relies on movement and manual pressure to clear waste. lymphatic massage moves lymph, exfoliates skin at its cellular renewal peak, and supports liver clearance of the hormone metabolites from the previous cycle. spend extra time on the inner thighs and armpits where lymph nodes cluster','☀️ morning sunlight within 30–60 min of waking — this single habit has outsized hormonal impact. early light exposure signals the brain&#39;s master clock to anchor your cortisol awakening response. a healthy cortisol spike at wake-up is anti-inflammatory and energizing, and prevents the afternoon cortisol dysregulation that disrupts FSH signaling. 10–20 min of outdoor morning light also advances melatonin onset at night, deepening sleep quality across the full cycle','📓 journaling new intentions and ideas — your mental clarity peaks in follicular, capture every thought','🎨 creative movement — dance, expressive arts, new classes, anything that feels like play','💆 facial gua sha or lymphatic massage — follicular skin is at peak cellular turnover due to estrogen acting on collagen-producing fibroblasts. gua sha strokes outward and upward drain the lymphatic channels under the jaw and cheekbones, reduce residual puffiness from the bleed, and stimulate microcirculation. use a rose quartz or jade tool with a facial oil — the ritual itself signals safety to the nervous system and supports the calm estrogen rise of this phase',
'✨ skincare this phase: your skin is rebuilding and at its most resilient — this is the best week to treat and brighten. rising estrogen stimulates collagen-producing fibroblasts and speeds cell turnover, meaning your skin repairs faster and responds better to active ingredients than any other phase. what your skin needs: antioxidant protection, gentle exfoliation, and targeted brightening. toxin free products to look for: vitamin C (L-ascorbic acid or ascorbyl glucoside) to protect collagen and brighten, niacinamide to minimize pores and even tone, and a lactic acid or mandelic acid exfoliant 1-2x this week (gentler than glycolic, still effective). this is also the ideal time for gua sha, facial massage, or a brightening mask — skin is plump, circulation is strong, and results are better now than any other phase'],
    movement: ['🏋️ strength training — muscles respond to resistance with greatest adaptation in the follicular phase','⚡ interval training (HIIT) — energy is building and recovery is fast','🥾 hiking and outdoor movement — combine cardio with nature exposure for hormonal benefits','🧘 yoga vinyasa flow — build heat and momentum with your naturally rising energy','🆕 try something entirely new — a class, a route, a sport; novelty thrives in follicular'],
    work: DEFAULT_TASKS.follicular,
    avoid_foods: [
      {name:'🫘 processed soy (soy isolate, soy protein)',why:'Unlike fermented soy (tempeh, miso, natto), processed soy isolates contain concentrated phytoestrogens that can overwhelm estrogen receptors during a phase when estrogen is already rising. This can disrupt follicle development and the natural hormonal cascade.'},
      {name:'🍷 alcohol',why:'The liver\'s ability to metabolize and clear estrogen is crucial in the follicular phase. Alcohol significantly impairs liver function, leading to estrogen accumulation that can disrupt the delicate hormonal rise needed for ovulation.'},
      {name:'🍞 refined carbohydrates',why:'Blood sugar instability disrupts the sensitive hormonal signaling cascade that coordinates the follicular phase and leads to ovulation. Erratic insulin spikes can suppress the proper rise of FSH and estrogen.'},
      {name:'🥛 conventional dairy with added hormones',why:'Non-organic dairy can contain bovine growth hormones and synthetic estrogens that compete with your own rising estrogen at receptor sites, potentially disrupting follicle development and ovulation timing.'},
    {name:'☕ excess caffeine (3+ cups)',why:'Caffeine elevates cortisol, which suppresses FSH signaling — the very hormone driving follicle development in this phase. Moderate intake (1–2 cups before noon) is fine for most women, but high intake during the follicular phase can delay or blunt ovulation by disrupting the delicate hormonal rise leading to the LH surge.'}
    ],
    avoid_lifestyle: ['📋 overplanning and over-structuring before the creative ideas have had space to form','🌙 all-nighters — rising energy absolutely requires quality sleep to build; sleep is where the hormones do their work','⏭️ skipping meals — your metabolism is ramping up and genuinely needs fuel; undereating now tanks energy later','💡 ignoring or dismissing new creative impulses that feel too bold or unrealistic to pursue']
  },
  ovulatory: {
    foods: [
      {name:'🌾 quinoa',why:'A complete protein providing all essential amino acids to support the intense energy demands of peak ovulation. Also high in magnesium and zinc, which support the hormonal peak and muscle performance.'},
      {name:'🫐 figs and berries',why:'Rich in antioxidants (anthocyanins, quercetin) that protect the egg from oxidative damage at its most vulnerable moment — during and just after release from the follicle. Vitamin C content also supports egg membrane integrity.'},
      {name:'🍗 turkey and chicken',why:'Lean protein that supports the significant energy output and physical demands of the ovulatory peak without inflammatory fats. Tryptophan in turkey also supports serotonin production.'},
      {name:'🥕 raw carrots',why:'Raw carrot fiber uniquely binds to excess estrogen in the intestine and carries it out of the body — preventing reabsorption after peak estrogen levels begin to fall post-ovulation. A simple daily carrot supports healthy estrogen clearance.'},
      {name:'🍉 watermelon',why:'Hydration and electrolytes support the fluid shifts that occur during ovulation. Lycopene (which gives watermelon its red color) is a powerful antioxidant that supports estrogen metabolism and uterine health.'},
      {name:'🌿 asparagus',why:'High in folate (critical for DNA protection during rapid cell division) and glutathione (the master antioxidant) — both essential for protecting egg quality at the moment of release.'},
      {name:'🍅 tomatoes',why:'Cooked tomatoes provide concentrated lycopene — one of the most powerful antioxidants for reproductive health. Supports uterine lining integrity and healthy estrogen metabolism.'},
      {name:'🥥 coconut water',why:'Natural electrolyte profile (potassium, sodium, magnesium) supports the fluid shifts and increased physical performance demands of the ovulatory phase. A cleaner option than commercial sports drinks.'},
      {name:'🍎 pomegranate',why:'One of the most antioxidant-dense foods available. Studies specifically suggest pomegranate extract supports uterine lining thickness and blood flow to the reproductive organs — making it ideal at ovulation.'},
      {name:'🌰 almonds',why:'Vitamin E is particularly important at ovulation for protecting the egg from oxidative stress. Magnesium supports the peak muscular and hormonal performance. A small handful is enough.'}
    ],
    teas: [
      {name:'🍵 red raspberry leaf',why:'During ovulation, raspberry leaf prepares the uterine lining for potential implantation by toning and strengthening the uterine muscle. Continue drinking from follicular through ovulation for cumulative benefit.'},
      {name:'🌹 rose hip',why:'One of the highest plant sources of vitamin C — which supports egg health, immune function, and collagen production in the follicle wall. Also contains bioflavonoids that enhance vitamin C absorption.'},
      {name:'🌺 hibiscus',why:'Rich in anthocyanins and antioxidants that support estrogen metabolism at peak levels. Naturally tart and refreshing — beautiful as an iced tea during the warm, energetic ovulatory phase. Avoid if pregnant or on blood pressure medications.'}
    ],
    supplements: [
      {name:'💊 vitamin E 200–400 IU',why:'The most critical antioxidant for protecting the egg at the moment of release from the follicle. Vitamin E deficiency is directly associated with impaired ovulation. Use natural d-alpha tocopherol, not synthetic dl-alpha.'},
      {name:'🔬 selenium 100–200 mcg',why:'Protects the follicle from oxidative damage during the LH surge and egg release. Also supports thyroid function, which directly regulates cycle regularity and ovulation. Don\'t exceed 400 mcg daily.'},
      {name:'⚡ CoQ10 200–400 mg',why:'Continue CoQ10 through ovulation for mitochondrial energy and antioxidant protection of the egg during its final stages of maturation and release. The most evidence-backed supplement in fertility research.'},
      {name:'🔬 selenium 100–200 mcg',why:'Selenium directly protects the follicle from oxidative damage during the LH surge and egg release — the most oxidatively stressful moment of the entire cycle. It is also essential for conversion of thyroid hormone T4 to active T3, and thyroid function directly regulates ovulation timing and cycle regularity. Brazil nuts (2 per day) are the most bioavailable food source. Do not exceed 400 mcg daily.'},
    {name:'🌿 magnesium glycinate 200–320 mg',why:'Supports smooth muscle function and nervous system regulation during peak output. Also helps maintain the estrogen-to-progesterone balance as the transition begins post-ovulation.'}
    ],
    body: ['📸 show up on camera — this is the single best time in your cycle to film content, go live, or post your face. estrogen at its peak measurably increases skin luminosity and vocal resonance. studies show observers consistently rate women as more confident and magnetic during ovulation. you are not imagining the glow. film the reel, record the talking head, go live — your biology is working for you','🎙️ voice journaling or recording a creative vision — verbal fluency peaks at ovulation due to estrogen acting on the brain&#39;s language centers. ideas that formed quietly in follicular now want to be spoken aloud. voice memos, talking through a business idea, recording podcast content, or a long voice note to a friend — verbal expression in this phase captures clarity that often dissolves in luteal','💆 book a massage or facial — your skin is glowing, lean into body care that celebrates it','🤝 schedule the social things: coffee dates, collaborations, live events — connection thrives now','🌞 spend meaningful time outside in natural light — your energy and visibility are at their peak',
'✨ skincare this phase: your skin needs almost nothing right now — this is your glow phase. peak estrogen and rising testosterone create maximum blood flow to the face, tighter pores, and the highest collagen and elastin production of your entire cycle. your complexion is naturally luminous and even. what your skin needs: protection and hydration to preserve the glow, nothing more. toxin free products to look for: a light dewy moisturizer, vitamin C serum to shield against oxidative stress, and zinc oxide SPF (choose mineral over chemical — zinc oxide sits on skin rather than being absorbed). if you notice oiliness creeping in as testosterone rises, a kaolin clay mask once this week manages sebum without stripping the glow'],
    movement: ['⚡ HIIT, running, or cycling — peak physical performance window, personal records are possible now','🏋️ strength training at maximum intensity — hormonal environment supports maximum muscle adaptation','🧘 group fitness classes — your social and physical energy align perfectly','💃 dance and expressive movement — your body wants to be seen, give it that'],
    work: DEFAULT_TASKS.ovulatory,
    avoid_foods: [
      {name:'🍷 alcohol',why:'Can directly disrupt the LH surge — the hormonal signal that triggers ovulation. Even moderate alcohol intake around the ovulation window can delay or suppress the surge, impacting conception for those trying and cycle regularity for everyone.'},
      {name:'☕ excess caffeine',why:'High caffeine intake can elevate cortisol and suppress the LH surge. If you\'re sensitive to caffeine, be especially mindful in the 2–3 days leading up to and during ovulation.'},
      {name:'🛒 ultra-processed foods',why:'Inflammatory foods suppress the delicate hormonal orchestration of ovulation. The LH surge is sensitive — a high inflammatory load from processed foods can blunt the signal or timing.'}
    ],
    avoid_lifestyle: ['🙈 hiding or playing small when your natural visibility and magnetism are at their absolute highest','📅 overcommitting your visible energy (social media, live events) so far in advance that you\'re depleted when the time arrives','🕯️ burning the candle at both ends — peak energy has a shelf life; protect the harvest so luteal isn\'t a crash']
  },
  luteal: {
    foods: [
      {name:'🦃 turkey',why:'Tryptophan is the amino acid precursor to serotonin — the neurotransmitter that naturally declines as progesterone rises and estrogen begins to fall. Turkey is one of the richest dietary sources of tryptophan for natural serotonin support.'},
      {name:'🎃 pumpkin seeds',why:'Zinc supports progesterone synthesis directly. Magnesium eases the PMS symptoms that come from its deficiency. A handful daily is one of the simplest, most effective nutritional interventions for luteal support.'},
      {name:'🍠 sweet potato',why:'Complex carbohydrates provide a slow, steady serotonin-supporting glucose release. The body craves carbs in luteal for a biological reason — they\'re serotonin precursor delivery vehicles. Choose complex sources over refined.'},
      {name:'🌻 sunflower seeds',why:'High in both vitamin E (reduces breast tenderness) and B6 (supports progesterone synthesis and reduces PMS). One of the most nutrient-dense seeds for the luteal phase in a single food.'},
      {name:'🫘 chickpeas',why:'Excellent source of vitamin B6 — the key nutrient for progesterone synthesis and PMS symptom reduction. Also high in fiber for gut motility, which tends to slow during the progesterone-dominant phase.'},
      {name:'🌾 tahini (sesame paste)',why:'Calcium and sesame lignans support progesterone production in late luteal. Calcium specifically has been clinically shown to reduce PMS symptoms including mood changes, bloating, and food cravings.'},
      {name:'🍫 dark chocolate (85%+)',why:'Magnesium for muscle relaxation (including the uterus pre-bleed), serotonin support, and real mood uplift. The craving for chocolate in luteal is your body\'s intelligent request for magnesium and serotonin precursors.'},
      {name:'🌾 oats',why:'B vitamins and complex carbohydrates steady the declining energy of late luteal. Beta-glucan fiber supports gut bacteria, which regulate estrogen and progesterone clearance. A warm bowl of oats in the morning is deeply regulating.'},
      {name:'🍎 cooked apples',why:'Gentle fiber from cooked fruit supports healthy gut motility (which slows in progesterone-dominant luteal). Pectin supports the microbiome and estrogen clearance, helping the body prepare for the transition to menstruation.'},
      {name:'🍚 brown rice',why:'Complex carbohydrates and B vitamins — particularly B1, B3, and B6 — stabilize the mood dips and energy crashes of late luteal. The low glycemic index prevents the blood sugar rollercoaster that amplifies PMS.'}
    ],
    teas: [
      {name:'🌿 vitex berry (chasteberry)',why:'The most researched herb for PMS and luteal phase support. Vitex acts on the pituitary gland to support progesterone production relative to estrogen. Most effective when taken consistently over 2–3 months rather than intermittently. Check contraindications with hormonal medications and fertility treatments.'},
      {name:'🌼 st. john\'s wort',why:'The most studied plant compound for mild-to-moderate mood support. Specifically helpful for the serotonin-decline mood symptoms of late luteal. Important: interacts with many medications including birth control — check with your doctor before using.'},
      {name:'🍃 passionflower',why:'Clinically shown to reduce anxiety and irritability — the exact symptoms that characterize late luteal and PMS. Works via GABA receptors in the brain (similar mechanism to anti-anxiety medications, but gentler). Makes an excellent evening tea.'},
      {name:'🌙 ashwagandha',why:'An adaptogen that specifically reduces cortisol — which is often elevated in late luteal when progesterone\'s calming effect begins to wane. Lower cortisol means less mood volatility, better sleep, and reduced physical PMS symptoms.'}
    ],
    supplements: [
      {name:'💊 magnesium glycinate 200–320 mg',why:'The single most clinically supported supplement for PMS. Studies show it significantly reduces mood symptoms (anxiety, irritability, depression), breast tenderness, water retention, and insomnia in the late luteal phase. Start taking 2 weeks before your period.'},
      {name:'⚡ vitamin B6 25–50 mg',why:'Supports progesterone synthesis and neurotransmitter (serotonin and dopamine) production. Clinical trials show B6 supplementation reduces PMS symptoms by up to 70% in some studies. Most effective when combined with magnesium.'},
      {name:'🌿 vitex (chasteberry) 400–500 mg',why:'Most evidence-backed herb for luteal phase deficiency and PMS. Supports healthy progesterone-to-estrogen ratio. Note: not appropriate during pregnancy, breastfeeding, or when using hormone-sensitive medications or fertility treatments.'},
      {name:'🌸 evening primrose oil 1–3 g',why:'Rich in GLA (gamma-linolenic acid) — an omega-6 that specifically reduces breast tenderness, inflammation, and overall PMS severity. Take throughout the luteal phase. Avoid if you have a clotting disorder.'}
    ],
    body: ['🏠 nesting rituals — the urge to clean, organize, and prepare your space in luteal is not a quirk, it is biology. progesterone drives this impulse in all mammalian females in the second half of their cycle. working with it is enormously productive: declutter, meal prep, organize your content calendar, deep-clean one area. the sense of completion feeds the nervous system exactly what it needs in this phase','🧘 deep stretching and foam rolling — progesterone causes ligament laxity and heightens nervous system sensitivity, both of which drive the body aches and tightness of late luteal. 10 min of hip flexor, hamstring, and thoracic spine work in the evening dramatically reduces PMS physical discomfort and helps the body prepare for the release of menstruation','🛁 bath with Epsom salts and lavender oil — transdermal magnesium and aromatic nervous system support','📝 journaling the unfiltered truth of this phase — emotions surfacing now are real information','😴 earlier bedtime than usual — progesterone peaks in the evening and genuinely asks for more sleep','🌙 candlelight evenings — progesterone metabolizes into allopregnanolone, a GABA receptor modulator that promotes deep sleep. but this only works when melatonin rises naturally. blue light from screens suppresses melatonin onset by up to 3 hours. in late luteal when progesterone is already declining, protecting this sleep chemistry is especially important. dim lights after 8pm and step away from screens 60–90 min before bed',
'🌿 yoni steam (pre-menstrual, days 25-28) — steaming in the 2-4 days before your period is one of the most well-regarded traditional applications of this practice. it gently warms the pelvic bowl, softens the cervix, and encourages healthy circulation into the uterus — all of which can reduce cramping severity and ease the transition into menstruation. recommended herbs for pre-menstrual steaming: rose petals (gentle, tonifying, and deeply supportive for premenstrual emotions), lavender (nervine and calming — especially helpful if you experience anxiety or irritability in late luteal), calendula (anti-inflammatory and soothing for pelvic congestion), chamomile (antispasmodic and nervine — eases tension in the uterine muscle before the bleed begins), cramp bark (a specific herb for uterine spasm — one of the most evidence-supported herbs for menstrual cramping, though note it works better as a tea taken internally; in a steam it provides gentle aromatherapeutic benefit). note on mugwort in late luteal: mugwort is emmenagogic and can bring on the period — this is actually appropriate for pre-menstrual steaming if your goal is to encourage timely onset, but avoid it if your cycle is unpredictable, if you are trying to conceive, or if you are even possibly pregnant. note on ginger: warming and circulatory but can be quite intense — use sparingly or omit if you run hot or have heavy periods. how to: same method as above — herbs steeped in just-boiled water, steam reduced to comfortably warm, 10-20 min. stop immediately if you feel any burning or discomfort. contraindications: never steam during bleeding, if pregnant or possibly pregnant, if you have an active infection, an IUD, or open sores',
'✨ skincare this phase: your skin needs pore-clearing and inflammation control right now. progesterone surges after ovulation, increasing sebum production and slowing the rate at which skin cells shed — this combination clogs pores and creates the hormonal breakouts that cluster around the chin, jaw, and cheeks. what your skin needs: gentle exfoliation to keep pores clear, oil-controlling care, and anti-inflammatory support. toxin free products to look for: willow bark extract (a natural source of salicylic acid that clears pores without the harshness of synthetic BHAs), kaolin clay for a mid-week mask to absorb excess sebum, diluted tea tree oil as a spot treatment, and zinc-based products to calm inflammation. switch to a lighter gel moisturizer. avoid heavy facial oils and butters in late luteal. most importantly: do not pick. progesterone slows wound healing, so any picking now creates marks that take two to three times longer to fade than at any other phase'],
    movement: ['🚶 walking and gentle hikes — steady, low-impact circulation without taxing the nervous system','🧘 pilates and low-impact strength — maintain without depleting','🧘 restorative yoga — especially hip-opening poses which release pelvic tension','🏊 swimming — the full-body, low-impact quality of water feels uniquely soothing in luteal'],
    work: DEFAULT_TASKS.luteal,
    avoid_foods: [
      {name:'🍬 refined sugar',why:'Spikes blood sugar rapidly, then crashes it — directly amplifying the serotonin depletion of late luteal. The crash triggers more cravings and intensifies irritability, brain fog, and mood swings. Choose complex carbs for the same comfort without the crash.'},
      {name:'🍷 alcohol',why:'Disrupts the sleep architecture progesterone supports. Amplifies mood swings by depleting B vitamins and GABA. Particularly impactful in late luteal when the hormonal ground is already shifting. Even one drink can worsen PMS symptoms measurably.'},
      {name:'☕ excess caffeine',why:'Elevates cortisol at exactly the phase when the body is asking for calm. Worsens anxiety, breast tenderness, and insomnia. If you can\'t cut it entirely, reduce by half and avoid after noon.'},
      {name:'🧂 salty processed foods',why:'Sodium causes water retention that worsens the progesterone-driven bloating of late luteal. This is why PMS bloating can feel so uncomfortable — hormonal water retention compounded by dietary sodium.'},
      {name:'🥛 conventional dairy',why:'Can worsen prostaglandin production and inflammation in the days before menstruation begins. The arachidonic acid in conventional dairy feeds the inflammatory cascade that drives cramping. Choose organic or plant-based alternatives if you\'re sensitive.'}
    ],
    avoid_lifestyle: ['📅 overloading your social calendar with obligations that require performance energy','🚀 launching major new projects when your energy is genuinely designed for completing, not starting','📱 numbing with screens or alcohol when the emotions and sensations arise — they\'re information, not problems','🤐 over-explaining or apologizing for needing space, solitude, or a lighter schedule']
  }
};
