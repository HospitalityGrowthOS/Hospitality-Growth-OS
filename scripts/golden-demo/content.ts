/**
 * Golden Demo Venue — content.
 *
 * Bistro Saint-Laurent, Québec City. This file holds the written material:
 * identity, menu, rewards, guest names, review text, AI conversations.
 *
 * Deliberately hand-written rather than generated. This is Customer #0 — the
 * permanent reference venue — and it is demo *content*, not platform
 * architecture. Chapter 33's simulation engine is a separate concern and is
 * explicitly not what this is.
 */

// ── Identity ─────────────────────────────────────────────────────────────────

export const VENUE = {
  name: 'Bistro Saint-Laurent',
  slug: 'demo',
  city: 'Québec',
  address: '1042 Rue Saint-Jean, Québec, QC G1R 1S1',
  phone: '+1 418 555 0142',
  email: 'bonjour@bistrosaintlaurent.ca',
  website: 'bistrosaintlaurent.ca',
  cuisine: 'Bistro français · terroir québécois',
  slogan: 'Le terroir québécois, servi simplement.',
  story:
    "Ouvert en 2019 dans une maison de pierre du Vieux-Québec, le Bistro Saint-Laurent " +
    "sert une cuisine de marché inspirée du terroir québécois : canard de la Ferme Le Canard Goulu, " +
    "fromages de l'Île-aux-Grues, poissons du Bas-Saint-Laurent. Quarante-huit places, " +
    "une carte qui change avec les saisons, et une cave qui met les vignerons d'ici à l'honneur.",
  owner: { name: 'Mathieu Tremblay', role: 'Propriétaire' },
  chef: { name: 'Camille Lavoie', role: 'Chef de cuisine' },
  team: [
    { name: 'Sophie Bergeron', role: 'Directrice de salle' },
    { name: 'Étienne Roy',     role: 'Sommelier' },
    { name: 'Marie-Pier Caron', role: 'Chef pâtissière' },
  ],
  capacity: 48,
  /** Closed Mondays. Lunch Tue–Fri, dinner Tue–Sun. */
  hours: {
    monday:    null,
    tuesday:   { lunch: '11:30–14:00', dinner: '17:30–22:00' },
    wednesday: { lunch: '11:30–14:00', dinner: '17:30–22:00' },
    thursday:  { lunch: '11:30–14:00', dinner: '17:30–22:30' },
    friday:    { lunch: '11:30–14:00', dinner: '17:30–23:00' },
    saturday:  { lunch: null,          dinner: '17:00–23:00' },
    sunday:    { lunch: '10:30–14:30', dinner: '17:00–21:00' },
  },
  brand: {
    primary: '#1F3A2E',    // vert forêt
    accent:  '#C8A45A',    // or vieilli
    paper:   '#F7F3EC',
    typography: 'Displays: Canela · Body: Söhne',
    photography: 'Lumière naturelle, tons chauds, assiettes vues de haut, grain argentique',
  },
  social: { instagram: '@bistrosaintlaurent', facebook: 'BistroSaintLaurentQc' },
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuItem {
  name: string
  description: string
  price: number
  category: string
  allergens: string[]
  dietary: string[]
  popularity: 'signature' | 'strong' | 'steady' | 'slow'
  seasonal?: string
  chefSpecial?: boolean
  /** Food cost as a share of price — drives the margin analysis. */
  cost: number
}

export const MENU: MenuItem[] = [
  // ── Entrées ────────────────────────────────────────────────────────────────
  { name: 'Tartare de bœuf Charlevoix', description: "Bœuf de Charlevoix coupé au couteau, câpres, échalote grise, jaune d'œuf confit, pain grillé au levain", price: 19, category: 'Entrées', allergens: ['œufs', 'gluten', 'moutarde'], dietary: [], popularity: 'signature', cost: 0.34 },
  { name: 'Soupe à l\'oignon gratinée', description: "Oignons caramélisés lentement, bouillon de bœuf, croûton, gruyère de l'Île-aux-Grues", price: 14, category: 'Entrées', allergens: ['lait', 'gluten'], dietary: ['végétarien'], popularity: 'strong', cost: 0.22 },
  { name: 'Salade de betteraves rôties', description: "Betteraves du Potager Riverain, chèvre frais de Chèvrerie Fruit d'une Passion, noix de Grenoble, vinaigrette à l'érable", price: 16, category: 'Entrées', allergens: ['lait', 'noix'], dietary: ['végétarien', 'sans gluten'], popularity: 'steady', cost: 0.28 },
  { name: 'Croquettes de morue de Gaspé', description: 'Morue salée, pomme de terre, aïoli au citron confit', price: 17, category: 'Entrées', allergens: ['poisson', 'œufs', 'gluten'], dietary: [], popularity: 'steady', cost: 0.31 },
  { name: 'Foie gras poêlé, pommes et érable', description: "Foie gras du Québec, compote de pommes Cortland, réduction d'érable, brioche maison", price: 26, category: 'Entrées', allergens: ['lait', 'gluten', 'œufs'], dietary: [], popularity: 'strong', chefSpecial: true, cost: 0.38 },

  // ── Plats ──────────────────────────────────────────────────────────────────
  { name: 'Magret de canard, sauce aux cerises de terre', description: 'Canard du Canard Goulu, cerises de terre, purée de céleri-rave, jus corsé', price: 39, category: 'Plats', allergens: ['lait'], dietary: ['sans gluten'], popularity: 'signature', cost: 0.32 },
  { name: 'Joue de bœuf braisée au vin rouge', description: "Braisée huit heures, purée de pomme de terre à l'huile d'olive, carottes glacées", price: 34, category: 'Plats', allergens: ['lait', 'sulfites'], dietary: [], popularity: 'strong', cost: 0.29 },
  { name: 'Flétan du Bas-Saint-Laurent', description: 'Flétan poêlé, beurre blanc au vin de glace, poireaux confits, salicorne', price: 42, category: 'Plats', allergens: ['poisson', 'lait', 'sulfites'], dietary: ['sans gluten'], popularity: 'strong', cost: 0.41 },
  { name: 'Risotto aux champignons sauvages', description: "Champignons du Québec, bouillon de légumes, huile de truffe, pecorino", price: 29, category: 'Plats', allergens: ['lait', 'sulfites'], dietary: ['végétarien', 'sans gluten'], popularity: 'steady', cost: 0.24 },
  { name: 'Cassoulet végane du bistro', description: 'Haricots blancs, saucisse végétale maison, tomates confites, chapelure aux herbes', price: 27, category: 'Plats', allergens: ['gluten', 'soja'], dietary: ['végane'], popularity: 'slow', cost: 0.21 },
  { name: 'Côte de porc de la Ferme Gaspor', description: "Côte épaisse, chou braisé au cidre, moutarde à l'ancienne, pommes rôties", price: 36, category: 'Plats', allergens: ['moutarde', 'sulfites'], dietary: ['sans gluten'], popularity: 'steady', cost: 0.30 },
  { name: 'Pâtes fraîches au homard des Îles', description: 'Tagliatelles maison, homard des Îles-de-la-Madeleine, bisque crémée, estragon', price: 46, category: 'Plats', allergens: ['crustacés', 'gluten', 'lait', 'œufs'], dietary: [], popularity: 'strong', seasonal: 'mai–juillet', cost: 0.44 },

  // ── Desserts ───────────────────────────────────────────────────────────────
  { name: 'Tarte au sucre revisitée', description: "Sucre d'érable de Beauce, crème crue, glace au sirop", price: 13, category: 'Desserts', allergens: ['lait', 'gluten', 'œufs'], dietary: ['végétarien'], popularity: 'signature', cost: 0.18 },
  { name: 'Pouding chômeur au caramel salé', description: 'Servi tiède, crème glacée à la vanille de Madagascar', price: 12, category: 'Desserts', allergens: ['lait', 'gluten', 'œufs'], dietary: ['végétarien'], popularity: 'strong', cost: 0.16 },
  { name: 'Assiette de fromages du Québec', description: "Quatre fromages affinés, confiture de canneberges, noix, pain aux raisins", price: 21, category: 'Desserts', allergens: ['lait', 'gluten', 'noix'], dietary: ['végétarien'], popularity: 'steady', cost: 0.42 },
  { name: 'Sorbet aux petits fruits sauvages', description: 'Bleuets du Lac-Saint-Jean, camerises, chicoutai', price: 11, category: 'Desserts', allergens: [], dietary: ['végane', 'sans gluten'], popularity: 'slow', cost: 0.19 },

  // ── Boissons ───────────────────────────────────────────────────────────────
  { name: 'Vin au verre — rouge du Québec', description: 'Vignoble du Ruisseau, Frontenac noir', price: 14, category: 'Boissons', allergens: ['sulfites'], dietary: ['végane'], popularity: 'strong', cost: 0.26 },
  { name: 'Vin au verre — blanc de Charlevoix', description: 'Vignoble Le Nordet, Vidal', price: 13, category: 'Boissons', allergens: ['sulfites'], dietary: ['végane'], popularity: 'strong', cost: 0.25 },
  { name: 'Cocktail Saint-Laurent', description: 'Gin Ungava, sirop de sapin baumier, citron, mousse', price: 16, category: 'Boissons', allergens: [], dietary: ['végane'], popularity: 'signature', cost: 0.21 },
  { name: 'Cidre de glace, Neige Première', description: 'Servi en flûte, 60 ml', price: 12, category: 'Boissons', allergens: ['sulfites'], dietary: ['végane'], popularity: 'steady', cost: 0.23 },
  { name: 'Bière de microbrasserie', description: 'Sélection rotative — La Barberie, Griendel', price: 9, category: 'Boissons', allergens: ['gluten'], dietary: ['végane'], popularity: 'strong', cost: 0.28 },
  { name: 'Café filtre Brûlerie de Québec', description: 'Torréfaction locale, filtre ou espresso', price: 5, category: 'Boissons', allergens: [], dietary: ['végane'], popularity: 'strong', cost: 0.14 },
]

// ── Loyalty rewards ──────────────────────────────────────────────────────────

export const REWARDS = [
  { name: 'Café ou thé offert',            description: 'Un café filtre ou thé au choix', points_cost: 150,  type: 'free_item' as const },
  { name: 'Dessert du moment offert',      description: 'Le dessert de la carte, offert', points_cost: 400,  type: 'free_item' as const },
  { name: 'Coupe de vin offerte',          description: 'Un verre de la sélection du sommelier', points_cost: 600, type: 'free_item' as const },
  { name: 'Entrée offerte',                description: "Une entrée au choix de la carte", points_cost: 900,  type: 'free_item' as const },
  { name: 'Menu dégustation pour deux',    description: 'Cinq services, accords en supplément', points_cost: 5000, type: 'experience' as const },
]

// ── Guest names — Québec ─────────────────────────────────────────────────────

export const FIRST_NAMES = [
  'Mathieu','Sophie','Étienne','Marie-Pier','Guillaume','Catherine','Simon','Émilie','Alexandre','Julie',
  'Vincent','Geneviève','Antoine','Valérie','Nicolas','Isabelle','Maxime','Caroline','Olivier','Stéphanie',
  'François','Annie','Jean-Philippe','Mélanie','Sébastien','Josée','Patrick','Nathalie','Charles','Véronique',
  'Louis','Marie-Claude','Gabriel','Chantal','Samuel','Sylvie','Benoît','Marie-Ève','David','Karine',
  'Philippe','Manon','Jérôme','Andréanne','Frédéric','Camille','Hugo','Roxanne','Raphaël','Noémie',
]

export const LAST_NAMES = [
  'Tremblay','Gagnon','Roy','Côté','Bouchard','Gauthier','Morin','Lavoie','Fortin','Gagné',
  'Ouellet','Pelletier','Bélanger','Lévesque','Bergeron','Leblanc','Paquette','Girard','Simard','Boucher',
  'Caron','Beaulieu','Cloutier','Dubé','Poirier','Fournier','Lapointe','Leclerc','Lefebvre','Poulin',
  'Thibault','Nadeau','Grenier','Desjardins','Rousseau','Turcotte','Bédard','Hébert','Michaud','Richard',
]

/** A handful of non-francophone names — Québec City draws visitors. */
export const VISITOR_NAMES = [
  ['James','Whitfield'], ['Sarah','O\'Connell'], ['Michael','Brennan'], ['Emma','Lindqvist'],
  ['Thomas','Müller'], ['Laura','Bianchi'], ['Daniel','Kowalski'], ['Yuki','Tanaka'],
  ['Marco','Rossi'], ['Claire','Dubois'], ['Peter','Van Dijk'], ['Ana','Silva'],
]

// ── Review text, by rating and cause ─────────────────────────────────────────

export const REVIEWS_5 = [
  "Le magret de canard était parfait, cuisson exacte, et le service d'Étienne aux vins a fait toute la soirée. On revient sans hésiter.",
  "Notre troisième visite cette année et jamais déçus. La tarte au sucre revisitée vaut le détour à elle seule.",
  "Ambiance chaleureuse dans une belle maison de pierre. La chef Lavoie sait ce qu'elle fait. Excellent rapport qualité-prix pour ce niveau.",
  "Soirée d'anniversaire réussie. Ils avaient noté l'occasion et sont arrivés avec un dessert surprise. Ces attentions-là font la différence.",
  "Meilleur tartare à Québec, point. Coupé au couteau, assaisonné juste comme il faut.",
  "Le flétan était impeccable et le beurre blanc au vin de glace, une belle idée. Carte des vins québécois très bien montée.",
  "On y va pour les affaires le midi et c'est toujours rapide sans être expéditif. Parfait pour recevoir un client.",
  "Service attentionné, on nous a expliqué chaque plat sans être envahissant. Le sommelier connaît vraiment ses vins.",
  "Découvert par hasard en visitant le Vieux-Québec. Quelle belle surprise. On a réservé pour le lendemain soir.",
  "La joue de bœuf braisée fond littéralement. Huit heures de cuisson, ça se sent.",
  "Le cocktail au sapin baumier est original sans être prétentieux. Toute la carte est comme ça.",
  "Anniversaire de mariage. Table près de la fenêtre comme demandé, service impeccable du début à la fin.",
]

export const REVIEWS_4 = [
  "Très bonne cuisine, service un peu lent en début de soirée mais l'équipe était souriante. On reviendra.",
  "Excellente nourriture. Le restaurant est petit donc c'est bruyant quand c'est plein, à savoir.",
  "Le risotto était bien exécuté. J'aurais aimé un peu plus de choix végétariens sur la carte.",
  "Belle expérience. Les portions sont raisonnables, pas énormes, mais la qualité est là.",
  "Bon repas d'affaires. Le stationnement dans le Vieux-Québec reste compliqué, prévoyez du temps.",
  "Cuisine soignée et personnel accueillant. Un peu cher pour un souper de semaine mais ça se justifie.",
  "On a bien mangé. Le dessert était le point fort. Service correct sans plus ce soir-là.",
]

export const REVIEWS_3 = [
  "Correct sans être mémorable. La cuisine est bonne mais on a attendu quarante minutes entre l'entrée et le plat.",
  "Bon produit, exécution inégale. Mon plat était parfait, celui de ma conjointe tiède.",
  "L'endroit est charmant mais le rapport qualité-prix m'a semblé juste. Peut-être un soir difficile.",
]

export const REVIEWS_2 = [
  "Réservation à 19h30 un vendredi, on nous a assis à 20h05 et le plat principal est arrivé à 21h15. La cuisine est bonne mais l'attente a gâché la soirée.",
  "Beaucoup trop long. Presque une heure d'attente pour les plats un samedi soir. Le personnel semblait débordé et personne ne nous a tenus au courant.",
  "Nourriture correcte mais service désorganisé ce soir-là. On a dû redemander l'eau trois fois. Décevant pour le prix.",
  "Le canard était froid quand il est arrivé. Ils l'ont repris sans discuter, mais on avait déjà attendu quarante minutes.",
  "Un vendredi soir chargé et ça se sentait partout. Cuisine en retard, salle débordée. On a aimé les plats mais pas l'expérience.",
]

export const REVIEWS_1 = [
  "Deux heures et quart pour un souper à trois services un samedi. On a fini par annuler le dessert pour partir. Vraiment dommage parce que la cuisine mérite mieux.",
]

// ── AI conversations ─────────────────────────────────────────────────────────

export const CONVERSATIONS: { topic: string; turns: { role: 'user' | 'assistant'; content: string }[] }[] = [
  {
    topic: 'reservation',
    turns: [
      { role: 'user', content: 'Bonjour, auriez-vous une table pour 4 samedi soir vers 19h ?' },
      { role: 'assistant', content: "Bonjour ! Avec plaisir, je note votre demande pour 4 personnes samedi à 19h. Notre équipe vous confirmera la disponibilité très bientôt. Y a-t-il une occasion particulière ?" },
      { role: 'user', content: "C'est pour l'anniversaire de ma mère." },
      { role: 'assistant', content: "Quelle belle occasion ! Je l'ai noté pour l'équipe. Ils verront ce qu'ils peuvent préparer. À samedi !" },
    ],
  },
  {
    topic: 'allergens',
    turns: [
      { role: 'user', content: 'Ma fille est allergique aux arachides. Est-ce que vos desserts sont sécuritaires ?' },
      { role: 'assistant', content: "Je préfère être prudent plutôt que de deviner sur une allergie. Nos plats sont préparés dans une cuisine commune, alors nous ne pouvons garantir l'absence totale de traces. Mentionnez l'allergie à votre serveur à l'arrivée : il vérifiera directement avec la chef Lavoie avant toute préparation." },
      { role: 'user', content: "Parfait, merci de la franchise." },
      { role: 'assistant', content: "C'est important. À bientôt au Bistro Saint-Laurent !" },
    ],
  },
  {
    topic: 'wine_pairing',
    turns: [
      { role: 'user', content: 'Quel vin conseillez-vous avec le magret de canard ?' },
      { role: 'assistant', content: "Excellent choix de plat ! Notre rouge du Québec au verre, un Frontenac noir du Vignoble du Ruisseau, accompagne très bien le canard et les cerises de terre. Étienne, notre sommelier, pourra aussi vous proposer une bouteille selon vos goûts." },
    ],
  },
  {
    topic: 'hours',
    turns: [
      { role: 'user', content: 'Vous êtes ouverts le lundi ?' },
      { role: 'assistant', content: "Nous sommes fermés le lundi. Nous servons du mardi au dimanche — midi du mardi au vendredi et le dimanche, et le soir tous les jours sauf lundi. Puis-je vous aider à réserver un autre soir ?" },
    ],
  },
  {
    topic: 'vegan',
    turns: [
      { role: 'user', content: 'Avez-vous des options véganes ?' },
      { role: 'assistant', content: "Oui ! Notre cassoulet végane du bistro — haricots blancs, saucisse végétale maison, tomates confites — et en dessert le sorbet aux petits fruits sauvages. La salade de betteraves peut aussi être servie sans le fromage." },
    ],
  },
  {
    topic: 'parking',
    turns: [
      { role: 'user', content: 'Où peut-on se stationner ?' },
      { role: 'assistant', content: "Le stationnement dans le Vieux-Québec demande un peu de patience. Le stationnement d'Youville est à cinq minutes à pied, et il y a des places sur rue rue Saint-Jean après 18h. Prévoyez quelques minutes de plus si vous venez un vendredi ou samedi soir." },
    ],
  },
  {
    topic: 'private_event',
    turns: [
      { role: 'user', content: 'Est-ce possible de privatiser pour 25 personnes en décembre ?' },
      { role: 'assistant', content: "C'est tout à fait envisageable — notre salle accueille 48 places, alors 25 personnes fonctionne bien. Décembre se remplit vite par contre. Je transmets votre demande à Sophie, notre directrice de salle, qui vous reviendra avec les dates et les formules." },
    ],
  },
  {
    topic: 'takeaway',
    turns: [
      { role: 'user', content: 'Faites-vous des commandes pour emporter ?' },
      { role: 'assistant', content: "Nous ne faisons pas de commandes pour emporter — la cuisine est pensée pour être servie à table. Je peux par contre vous aider à réserver si vous souhaitez venir sur place." },
    ],
  },
  {
    topic: 'children',
    turns: [
      { role: 'user', content: 'On vient avec deux enfants de 6 et 9 ans, est-ce approprié ?' },
      { role: 'assistant', content: "Bien sûr, les familles sont les bienvenues, particulièrement au service du midi et en début de soirée. La cuisine peut préparer des portions adaptées pour les enfants — mentionnez-le simplement en arrivant." },
    ],
  },
  {
    topic: 'complaint',
    turns: [
      { role: 'user', content: "Nous avons soupé chez vous vendredi et avons attendu plus d'une heure entre l'entrée et le plat. C'était long." },
      { role: 'assistant', content: "Je suis vraiment désolé, ce n'est pas l'expérience que nous voulons vous offrir et votre déception est tout à fait légitime. Je transmets immédiatement votre message à Mathieu, le propriétaire, qui vous contactera personnellement. Merci de nous l'avoir signalé." },
    ],
  },
]

// ── Campaigns ────────────────────────────────────────────────────────────────

export const CAMPAIGNS = [
  { name: 'Saint-Valentin — menu en cinq services', type: 'promotional' as const, monthsAgo: 5,
    message: "Le 14 février au Bistro Saint-Laurent : cinq services, accords proposés par Étienne. Places limitées à 48. Réservez tôt.", audience: 'all' },
  { name: 'Fête des Mères — brunch du dimanche', type: 'promotional' as const, monthsAgo: 2,
    message: "Dimanche 10 mai, brunch spécial Fête des Mères. Menu à la carte, mimosa offert aux mamans.", audience: 'all' },
  { name: 'Dégustation de vins québécois', type: 'promotional' as const, monthsAgo: 4,
    message: "Jeudi soir : Étienne présente six vignerons du Québec, avec bouchées de la chef. 65 $ par personne.", audience: 'wine' },
  { name: 'Temps des fêtes — réservations de groupe', type: 'announcement' as const, monthsAgo: 7,
    message: "Décembre approche et les soirs se remplissent vite. Réservez votre repas de groupe dès maintenant.", audience: 'all' },
  { name: 'Menu terrasse — été', type: 'promotional' as const, monthsAgo: 11,
    message: "La terrasse est ouverte. Nouveau menu d'été, homard des Îles jusqu'en juillet.", audience: 'all' },
  { name: 'On ne vous a pas vu depuis un moment', type: 'winback' as const, monthsAgo: 3,
    message: "Ça fait un moment ! Vos points vous attendent au Bistro Saint-Laurent. Au plaisir de vous revoir.", audience: 'inactive' },
  { name: 'Table du chef — quatre soirs seulement', type: 'promotional' as const, monthsAgo: 1,
    message: "Camille ouvre la table du chef : huit places, quatre soirs, menu surprise. Réservé aux membres Or et Argent.", audience: 'vip' },
  { name: 'Midi affaires — nouvelle formule', type: 'promotional' as const, monthsAgo: 6,
    message: "Nouvelle formule midi : entrée, plat et café en 45 minutes. Idéal pour recevoir un client.", audience: 'business' },
]
