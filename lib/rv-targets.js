// ===== REMOTE VIEWING — POOL DE CIBLES =====
// Reste côté serveur : jamais envoyé au client avant la révélation d'une session,
// pour que l'exercice reste "en aveugle" jusqu'au bout.

const TARGET_POOL = [
  { key: 'volcan',        label: 'Volcan en éruption',        emoji: '🌋', category: 'nature',      description: 'Une montagne qui crache du feu et de la roche en fusion.',              tags: ['massif','chaud','rouge','noir','énergique','extérieur','naturel','bruyant'] },
  { key: 'cascade',       label: 'Cascade en forêt',          emoji: '💦', category: 'nature',      description: "De l'eau qui tombe entre des rochers moussus, au cœur des arbres.",     tags: ['vertical','fluide','humide','froid','bleu','vert','naturel','extérieur','bruyant'] },
  { key: 'desert',        label: 'Dunes de désert',           emoji: '🏜️', category: 'nature',     description: 'Des vagues de sable doré à perte de vue sous un soleil de plomb.',       tags: ['courbe','sec','chaud','doré','jaune','naturel','extérieur','calme'] },
  { key: 'glacier',       label: 'Glacier polaire',           emoji: '🧊', category: 'nature',      description: 'Une immense étendue de glace bleutée, craquelée et silencieuse.',       tags: ['massif','dur','froid','blanc','bleu','naturel','extérieur','silencieux'] },
  { key: 'ocean',         label: "Vague de l'océan",          emoji: '🌊', category: 'nature',      description: "Une vague puissante qui se dresse et s'écrase sur elle-même.",          tags: ['courbe','fluide','humide','froid','bleu','aquatique','naturel','énergique','bruyant'] },
  { key: 'orage',         label: 'Orage électrique',          emoji: '⚡', category: 'nature',      description: "Un éclair déchire un ciel noir chargé d'électricité.",                  tags: ['pointu','énergique','noir','jaune','bruyant','extérieur','naturel','froid'] },
  { key: 'aurore',        label: 'Aurore boréale',            emoji: '🌌', category: 'nature',      description: 'Des voiles de lumière verte et violette ondulent dans le ciel nocturne.', tags: ['fluide','courbe','vert','multicolore','froid','calme','extérieur','naturel','silencieux'] },
  { key: 'foret',         label: 'Forêt de conifères',        emoji: '🌲', category: 'nature',      description: 'Des rangées d\'arbres sombres et pointus qui montent vers le ciel.',     tags: ['vertical','pointu','vert','naturel','extérieur','calme','froid'] },
  { key: 'geyser',        label: 'Geyser en éruption',        emoji: '⛲', category: 'nature',      description: "Un jet d'eau bouillante projeté brutalement vers le ciel.",             tags: ['vertical','fluide','chaud','humide','blanc','naturel','extérieur','bruyant','énergique'] },
  { key: 'recif',         label: 'Récif corallien',           emoji: '🐠', category: 'nature',      description: "Un jardin sous-marin coloré grouillant de petits poissons.",             tags: ['courbe','multicolore','humide','aquatique','naturel','léger','calme'] },
  { key: 'volcan_sm',     label: 'Volcan sous-marin',         emoji: '🌊', category: 'nature',      description: "Une fissure au fond de l'océan libère de la lave incandescente.",       tags: ['massif','chaud','rouge','noir','aquatique','naturel','énergique'] },
  { key: 'ruche',         label: "Ruche d'abeilles",          emoji: '🐝', category: 'nature',      description: 'Une structure hexagonale bourdonnante, dense et organisée.',            tags: ['anguleux','massif','jaune','noir','énergique','bruyant','naturel','extérieur'] },
  { key: 'toile',         label: "Toile d'araignée",          emoji: '🕸️', category: 'nature',     description: 'Un motif géométrique fin et fragile, couvert de rosée.',                tags: ['courbe','léger','humide','blanc','naturel','extérieur','calme','silencieux'] },
  { key: 'oiseau',        label: 'Oiseau en plein vol',       emoji: '🦅', category: 'nature',      description: 'Une silhouette ailée qui plane haut au-dessus du paysage.',             tags: ['courbe','léger','marron','extérieur','naturel','calme','vertical'] },
  { key: 'felin',         label: 'Félin sauvage',             emoji: '🐆', category: 'nature',      description: 'Un animal tacheté, souple et silencieux, tapi dans les hautes herbes.',  tags: ['courbe','léger','marron','jaune','naturel','extérieur','silencieux','énergique'] },

  { key: 'pyramide',      label: 'Pyramide antique',          emoji: '🔺', category: 'structure',   description: 'Une structure massive et triangulaire posée sur le sable.',             tags: ['pointu','massif','doré','marron','ancien','extérieur','artificiel','calme'] },
  { key: 'cathedrale',    label: 'Cathédrale gothique',       emoji: '⛪', category: 'structure',   description: 'De hautes flèches de pierre et des vitraux colorés.',                   tags: ['vertical','pointu','massif','noir','ancien','intérieur','artificiel','calme'] },
  { key: 'gratte_ciel',   label: 'Gratte-ciel moderne',       emoji: '🏙️', category: 'structure',  description: 'Une tour de verre et d\'acier qui perce les nuages.',                   tags: ['vertical','dur','moderne','urbain','artificiel','bleu','extérieur'] },
  { key: 'pont',          label: 'Pont suspendu',             emoji: '🌉', category: 'structure',   description: "De longs câbles tendus au-dessus d'une étendue d'eau.",                 tags: ['horizontal','vertical','dur','rouge','moderne','artificiel','extérieur','urbain'] },
  { key: 'phare',         label: 'Phare sur la côte',         emoji: '🗼', category: 'structure',   description: 'Une tour rayée qui balaie la mer de son faisceau lumineux.',            tags: ['vertical','dur','blanc','rouge','aquatique','artificiel','extérieur','ancien'] },
  { key: 'moulin',        label: 'Moulin à vent',             emoji: '🎡', category: 'structure',   description: 'De grandes pales qui tournent lentement dans le vent.',                 tags: ['courbe','vertical','marron','extérieur','naturel','artificiel','calme','ancien'] },
  { key: 'temple',        label: 'Temple ancien',             emoji: '🛕', category: 'structure',   description: 'Des colonnes de pierre sculptée, silencieuses et sacrées.',             tags: ['vertical','massif','dur','marron','ancien','extérieur','artificiel','calme','silencieux'] },
  { key: 'chateau',       label: 'Château fort',              emoji: '🏰', category: 'structure',   description: 'De hautes murailles de pierre et des tours crénelées.',                 tags: ['vertical','massif','dur','marron','ancien','extérieur','artificiel'] },
  { key: 'tour_eiffel',   label: 'Tour de fer',               emoji: '🗼', category: 'structure',   description: "Une structure métallique en treillis qui s'élève très haut.",           tags: ['vertical','pointu','dur','marron','moderne','urbain','artificiel','extérieur'] },
  { key: 'labyrinthe',    label: 'Labyrinthe de haies',       emoji: '🌿', category: 'structure',   description: 'Des couloirs verts qui serpentent sans fin.',                           tags: ['courbe','anguleux','vert','naturel','extérieur','calme','silencieux'] },
  { key: 'serre',         label: 'Serre botanique',           emoji: '🪴', category: 'structure',   description: 'Une verrière chaude et humide remplie de plantes exotiques.',           tags: ['courbe','humide','chaud','vert','intérieur','artificiel','calme'] },
  { key: 'bibliotheque',  label: 'Bibliothèque ancienne',     emoji: '📚', category: 'structure',   description: 'De hautes étagères de bois chargées de vieux livres.',                  tags: ['vertical','dur','marron','ancien','intérieur','artificiel','calme','silencieux'] },

  { key: 'feu_artifice',  label: "Feu d'artifice",            emoji: '🎆', category: 'evenement',   description: 'Une explosion de lumières colorées dans le ciel nocturne.',             tags: ['énergique','multicolore','bruyant','extérieur','artificiel','léger'] },
  { key: 'carnaval',      label: 'Défilé de carnaval',        emoji: '🎭', category: 'evenement',   description: 'Une foule costumée, colorée et bruyante, en pleine fête.',              tags: ['multicolore','énergique','bruyant','extérieur','urbain','artificiel'] },
  { key: 'concert',       label: 'Concert de foule',          emoji: '🎤', category: 'evenement',   description: 'Une masse de gens vibrant sous des lumières et une musique forte.',     tags: ['énergique','bruyant','multicolore','intérieur','artificiel','moderne'] },
  { key: 'marche',        label: 'Marché animé',              emoji: '🧺', category: 'evenement',   description: 'Des étals colorés, des odeurs et des voix qui se mêlent.',              tags: ['multicolore','bruyant','énergique','extérieur','urbain','artificiel'] },
  { key: 'cirque',        label: 'Chapiteau de cirque',       emoji: '🎪', category: 'evenement',   description: 'Une tente rayée rouge et blanc, pleine de bruit et de lumière.',        tags: ['rouge','blanc','pointu','énergique','bruyant','extérieur','artificiel'] },
  { key: 'montgolfiere',  label: 'Montgolfière au décollage', emoji: '🎈', category: 'evenement',   description: 'Un immense ballon coloré qui s\'élève lentement dans le ciel.',          tags: ['courbe','multicolore','léger','calme','extérieur','artificiel'] },

  { key: 'train_vapeur',  label: 'Train à vapeur',            emoji: '🚂', category: 'objet',       description: 'Une locomotive noire qui souffle de la fumée blanche.',                 tags: ['horizontal','dur','noir','chaud','bruyant','énergique','artificiel','ancien'] },
  { key: 'sous_marin',    label: 'Sous-marin en plongée',     emoji: '🛥️', category: 'objet',      description: 'Une coque métallique qui s\'enfonce dans l\'obscurité aquatique.',       tags: ['horizontal','dur','noir','froid','aquatique','artificiel','moderne','silencieux'] },
  { key: 'vaisseau',      label: 'Vaisseau spatial',          emoji: '🛸', category: 'objet',       description: 'Une forme lisse et métallique suspendue dans le vide.',                 tags: ['courbe','lisse','dur','blanc','froid','moderne','artificiel','silencieux'] },
  { key: 'horloge',       label: 'Horloge mécanique géante',  emoji: '⏰', category: 'objet',       description: 'Des rouages dorés qui tournent avec précision derrière un cadran.',     tags: ['rond','dur','doré','ancien','intérieur','artificiel','énergique'] },
  { key: 'cristal',       label: 'Cristal de roche',          emoji: '💎', category: 'objet',       description: 'Une pointe transparente et facettée qui capte la lumière.',             tags: ['pointu','dur','lisse','blanc','multicolore','froid','naturel','silencieux'] },
  { key: 'coquillage',    label: 'Coquillage en spirale',     emoji: '🐚', category: 'objet',       description: 'Une forme enroulée, douce au toucher, ramenée par la marée.',           tags: ['courbe','lisse','blanc','marron','aquatique','naturel','léger','calme'] },
  { key: 'violon',        label: 'Violon ancien',             emoji: '🎻', category: 'objet',       description: 'Un instrument de bois verni, aux courbes élégantes.',                   tags: ['courbe','lisse','marron','ancien','intérieur','artificiel','calme'] },
];

// Vocabulaire de descripteurs proposé au viewer pendant la session (générique,
// ne trahit aucune cible précise — c'est le même principe que les listes de
// descripteurs utilisées en CRV réel).
const DESCRIPTOR_VOCAB = {
  'Formes':      ['rond','anguleux','vertical','horizontal','courbe','pointu','massif'],
  'Textures':    ['lisse','rugueux','dur','mou','humide','sec','fluide'],
  'Couleurs':    ['rouge','bleu','vert','jaune','blanc','noir','marron','doré','multicolore'],
  'Énergie':     ['chaud','froid','calme','énergique','lourd','léger','bruyant','silencieux'],
  'Environnement': ['naturel','artificiel','intérieur','extérieur','urbain','aquatique','ancien','moderne'],
};

module.exports = { TARGET_POOL, DESCRIPTOR_VOCAB };
