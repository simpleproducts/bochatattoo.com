/**
 * Per-category page copy, hand-written per subject in both languages.
 *
 * WHY this file exists as content rather than a template: a set of category
 * pages generated from one string template with the category name swapped in is
 * the textbook doorway-page pattern, and Google demotes it. Every intro here has
 * to be about tattooing THAT subject specifically — if a sentence stays true
 * with a different category name substituted, it is filler and does not belong.
 *
 * WHY 18 OF THE 21 CATEGORIES IN categories.json APPEAR HERE. Three are left
 * out, each for its own reason:
 *   - "random" and "ig2024" ("Varios" / "Miscellaneous") are organisational
 *     buckets, not subjects. There is nothing true and specific to say about a
 *     bucket, and the only page that could be written for one is the templated
 *     page this file exists to prevent. They stay browsable inside /work.
 *   - "antiguedad" ("Antigüedad") IS a real subject, but the archive currently
 *     holds zero pieces in it. Copy written for it would describe work nobody
 *     can see, and the page would 404 on the empty-category guard in
 *     CategoryPage.tsx regardless. When the studio publishes antiquity pieces,
 *     write the intro then — from the actual work — and add the slug below.
 *
 * Only slugs listed in CATEGORY_SLUGS get a page; consumers must gate on that
 * array, not on categories.json.
 *
 * WHY no piece counts appear in the copy: the archive changes, the copy does not
 * get redeployed with it, and a stale number in a meta description is a lie.
 */

export type CategoryCopy = {
  /** 55-60 char page title, WITHOUT the site name — metadata appends it. */
  title: string;
  /** 150-160 char meta description. */
  description: string;
  /** The h1. Distinct from title. */
  heading: string;
  /** 2-4 sentences of real prose about tattooing THIS subject. */
  intro: string;
};

type CategoryEntry = { es: CategoryCopy; en: CategoryCopy };

export const CATEGORY_COPY: Record<string, CategoryEntry> = {
  "best-tattoos": {
    es: {
      title: "Tatuajes destacados: mi selección, la que muestro primero",
      description:
        "Los tatuajes que elijo mostrar primero: una selección de piezas de todos los tamaños y temas, elegidas por cómo salieron. Almagro, Buenos Aires, desde 2015.",
      heading: "Lo que muestro primero.",
      intro:
        "Esto es una selección, no un tema: son las piezas que pongo adelante cuando alguien me pregunta qué hago. No están acá por ser las más grandes ni las más difíciles —hay minis en la lista— sino porque salieron como las tenía en la cabeza, o mejor. Si estás mirando el archivo por primera vez, empezá por acá y después seguí por el tema que te interese.",
    },
    en: {
      title: "Featured tattoos: the pieces I put in front of you first",
      description:
        "The tattoos I show first — a selection across every size and subject, chosen for how they came out, not for how hard they were. Buenos Aires, since 2015.",
      heading: "What I show first.",
      intro:
        "This is a selection, not a subject — the pieces I put in front of someone who asks what I do. They aren't here for being the biggest or the most technically demanding; there are minis on the list. They're here because they came out the way I had them in my head, or better. If you're seeing the archive for the first time, start here and then follow whichever subject pulls you.",
    },
  },

  arte: {
    es: {
      title: "Tatuajes de arte: pintura y escultura llevadas a la piel",
      description:
        "Obras de arte tatuadas en microrealismo ilustrativo: qué se conserva de una pintura cuando entra en un antebrazo y qué se resigna. Almagro, Buenos Aires.",
      heading: "Obras de arte en la piel.",
      intro:
        "Tatuar una obra no es copiarla: es decidir qué sobrevive al cambio de escala. Un cuadro de un metro tiene que entrar en un antebrazo, y la pincelada —que es materia, relieve y color— se traduce a densidad de línea y a grises suaves. Lo que se conserva es la estructura de valores y el gesto; el resto se resigna a propósito, y esa resignación es el diseño. Es la parte más grande del archivo y casi siempre empieza igual: alguien llega con una foto de museo en el teléfono.",
    },
    en: {
      title: "Art tattoos: painting and sculpture carried onto the skin",
      description:
        "Works of art tattooed in illustrative microrealism — what survives of a painting when it has to fit a forearm, and what gets given up. Almagro, Buenos Aires.",
      heading: "Works of art on skin.",
      intro:
        "Tattooing a painting isn't copying it — it's deciding what survives the change of scale. A canvas a metre wide has to fit on a forearm, and brushwork, which is thickness and colour and physical stuff, becomes line density and soft grey. What carries over is the value structure and the gesture; everything else is given up on purpose, and that decision is the design. It's the largest part of the archive, and it nearly always starts the same way: someone arrives with a museum photo on their phone.",
    },
  },

  botanica: {
    es: {
      title: "Tatuajes botánicos en línea fina: hojas, flores y tallos",
      description:
        "Botánica tatuada en línea fina: nervaduras, pétalos y tallos resueltos con poco gris y mucho aire, para que sigan legibles a los diez años. Archivo por tema.",
      heading: "Botánica en línea fina.",
      intro:
        "En botánica la línea hace casi todo el dibujo: la nervadura de una hoja, el filo de un pétalo, la torsión de un tallo que va buscando luz. La sombra entra después y apenas, solo para sugerir volumen, porque un pétalo demasiado trabajado se empasta y en unos años se cierra. Por eso el aire entre los elementos importa tanto como los elementos: la tinta se abre con el tiempo y hay que dejarle lugar de entrada. Muchas de estas piezas siguen el eje de un brazo o de la columna, como una lámina botánica que se acomodó a un cuerpo.",
    },
    en: {
      title: "Botanical tattoos in fineline: leaves, flowers and stems",
      description:
        "Botanical work in fine line — veining, petals and stems drawn with little grey and plenty of air, so they read ten years on. Browse the archive by subject.",
      heading: "Botanical in fineline.",
      intro:
        "In botanical work the line does nearly all the drawing: the veining of a leaf, the edge of a petal, the twist of a stem reaching for light. Shading comes second and stays thin, only enough to suggest volume, because an over-rendered petal turns to mud and closes up within a few years. So the air between elements matters as much as the elements — fine line spreads with age and has to be given the room from the start. A lot of these follow the axis of an arm or a spine, like a botanical plate that adapted itself to a body.",
    },
  },

  minis: {
    es: {
      title: "Tatuajes mini: piezas chiquitas pensadas para que aguanten",
      description:
        "Minis de pocos centímetros, diseñados para leerse dentro de diez años y no solo el día de la sesión. Primeras piezas y tatuajes que entran en un hueco libre.",
      heading: "Chiquitos, y que duren.",
      intro:
        "A tres centímetros no se puede agregar detalle, solo sacarlo. Cada línea que queda tiene que estar haciendo un trabajo, y el diseño se piensa para cómo va a verse dentro de diez años y no para cómo sale de la sesión: dos líneas que hoy casi se tocan mañana son una sola mancha. Son piezas rápidas, y muchas veces son la primera de alguien —o la quinta, la que entra justo en el hueco que quedó entre las otras.",
    },
    en: {
      title: "Mini tattoos: small pieces drawn to still read years later",
      description:
        "Minis of a few centimetres, drawn for how they read in ten years rather than on the day. First tattoos, and the small ones that fill a gap between others.",
      heading: "Small, and built to last.",
      intro:
        "At three centimetres you can't add detail, only take it away. Every line that stays has to be doing a job, and the drawing is made for how it looks in ten years rather than how it leaves the session: two lines that nearly touch today are one blot later. They're quick pieces, and often somebody's first — or their fifth, the one that slots into the gap left between the others.",
    },
  },

  animales: {
    es: {
      title: "Tatuajes de animales: pelaje, plumas y una mirada en gris",
      description:
        "Animales en microrealismo: la estructura primero, después el pelo trazo por trazo y el ojo a negro pleno. Retratos de mascotas en Almagro, Buenos Aires.",
      heading: "Pelo, pluma y mirada.",
      intro:
        "Un animal se sostiene o se cae en la estructura: si el cráneo está mal, no hay pelaje que lo salve. Recién después viene la textura, que en microrealismo se arma con trazos cortos en la dirección en que crece el pelo o se monta la pluma, y que a un metro se lee como pelaje aunque de cerca sean líneas sueltas. El ojo es lo único que va a negro pleno, con el brillo reservado desde la primera pasada: es lo que hace que el animal esté vivo y no embalsamado. Si es tu perro o tu gato, necesito una foto a la altura de sus ojos —las tomadas desde arriba, que son casi todas, achatan el hocico.",
    },
    en: {
      title: "Animal tattoos: fur, feathers and the eye, all in soft grey",
      description:
        "Animals in microrealism — structure first, then fur stroke by stroke, then the one eye that goes to full black. Pet portraits from Almagro, Buenos Aires.",
      heading: "Fur, feather and eye.",
      intro:
        "An animal stands or falls on structure: get the skull wrong and no amount of fur will rescue it. Texture comes after, built in microrealism from short strokes running the way the hair grows or the feather overlaps, so at arm's length it reads as coat even though up close it's loose lines. The eye is the only place that goes to full black, with the highlight saved from the first pass — it's what makes the animal alive rather than taxidermied. If it's your dog or your cat, I need a photo taken at their eye level; the ones shot from above, which is most of them, flatten the muzzle.",
    },
  },

  compo: {
    es: {
      title: "Composiciones: varias ideas resueltas en un solo tatuaje",
      description:
        "Composiciones de varios elementos en una pieza: qué tapa a qué, por dónde entra el ojo y cuánto aire queda. Diseñadas sobre el brazo, no sobre papel plano.",
      heading: "Varias ideas, una pieza.",
      intro:
        "Acá el trabajo no está en los elementos sino en el orden: qué tapa a qué, por dónde entra el ojo, cuánto aire queda entre una cosa y otra para que todo se lea junto y no como un amontonamiento. Casi siempre nacen de alguien que llega con cuatro ideas y no quiere descartar ninguna. Se diseñan sobre el miembro concreto y no sobre papel plano: un antebrazo se ve por partes mientras el brazo gira, así que la composición tiene que cerrar desde tres ángulos distintos.",
    },
    en: {
      title: "Compositions: several ideas resolved into a single tattoo",
      description:
        "Multi-element compositions — what overlaps what, where the eye enters, how much air is left. Designed onto the actual limb rather than onto flat paper.",
      heading: "Several ideas, one piece.",
      intro:
        "Here the work isn't in the elements, it's in the order: what overlaps what, where the eye enters, how much air is left between things so the whole reads at once instead of as a pile. They almost always begin with someone who arrives with four ideas and won't drop any of them. And they get drawn onto the actual limb rather than onto flat paper — a forearm is seen in parts as the arm turns, so the arrangement has to close from three different angles.",
    },
  },

  anatom: {
    es: {
      title: "Tatuajes de anatomía: corazones, cráneos, huesos y manos",
      description:
        "Anatomía en microrealismo: rayado, contrarrayado y grises que describen volumen sin contorno duro, como en una lámina antigua. Archivo de trabajos por tema.",
      heading: "Corazones, cráneos y huesos.",
      intro:
        "La ilustración anatómica ya viene escrita en el mismo idioma que el microrealismo: rayado, contrarrayado, grises que describen volumen sin necesidad de un contorno duro. Un corazón es un nudo de vasos y esos vasos son el dibujo entero; un cráneo se define por cómo cae la luz en la órbita y debajo del pómulo, y si se lo carga de negro deja de ser hueso y pasa a ser mancha. Son piezas que envejecen bien, porque el detalle vive en la forma y no en la delicadeza del gris.",
    },
    en: {
      title: "Anatomy tattoos: hearts, skulls, bone and the human hand",
      description:
        "Anatomical work in microrealism — hatching, cross-hatching and greys that describe volume without a hard outline, the way an old plate does. Archive by subject.",
      heading: "Hearts, skulls and bone.",
      intro:
        "Anatomical illustration already speaks the same language as microrealism: hatching, cross-hatching, greys that describe volume without needing a hard outline. A heart is a knot of vessels and those vessels are the entire drawing; a skull is defined by how the light drops into the socket and under the cheekbone, and load it with black and it stops being bone and becomes a smudge. These age well, because the detail lives in the form rather than in the delicacy of the grey.",
    },
  },

  musica: {
    es: {
      title: "Tatuajes de música: discos, guitarras y letras manuscritas",
      description:
        "Música tatuada a través del objeto concreto: la pala de una guitarra, un casete escrito a mano, una tapa de disco. Fineline y microrealismo, archivo por tema.",
      heading: "Discos, guitarras y letras.",
      intro:
        "Casi ninguna de estas piezas es sobre la música en abstracto: es sobre un objeto concreto —la pala de guitarra que alguien reconoce de lejos, un casete con la etiqueta escrita a mano, un disco que sonó en una casa determinada. Las tapas son diseño gráfico y se tatúan como diseño gráfico, con bordes limpios y negros parejos; un instrumento es realismo y pide laca, madera y reflejo. Cuando entra una letra manuscrita hay que darle más aire del que parece necesitar, porque la caligrafía fina y cerrada es lo primero que se empasta.",
    },
    en: {
      title: "Music tattoos: records, guitars and lyrics written by hand",
      description:
        "Music tattooed through the specific object — a headstock, a cassette labelled by hand, an album cover. Fineline and microrealism, browse the archive by subject.",
      heading: "Records, guitars and lyrics.",
      intro:
        "Almost none of these are about music in the abstract: they're about a specific object — the headstock somebody recognises across a room, a cassette with the label written by hand, a record that played in one particular house. Covers are graphic design and get tattooed as graphic design, clean-edged with flat blacks; an instrument is realism and wants lacquer, wood and reflection. When a handwritten lyric goes in it needs more air than it looks like it needs, because tight fine script is the first thing to close up.",
    },
  },

  retratos: {
    es: {
      title: "Retratos tatuados en microrealismo: dar con el parecido real",
      description:
        "Retratos en microrealismo: el parecido se juega en milímetros y el contraste se construye alto desde el día uno. Estudio privado en Almagro, Buenos Aires.",
      heading: "Retratos en microrealismo.",
      intro:
        "Un retrato se juega en milímetros: la distancia entre el ojo y la ceja, la caída de la comisura, el ancho del puente de la nariz. Por eso pido una foto nítida, con luz pareja, de frente o de tres cuartos —una imagen quemada o pixelada no se arregla en la piel, se hereda. También hay un tamaño mínimo por debajo del cual una cara deja de ser esa cara, y prefiero decírtelo antes y no después. El contraste se construye alto desde el día uno porque el gris se ablanda con los años: un retrato que hoy está justo, en una década está lavado.",
    },
    en: {
      title: "Portrait tattoos in microrealism: getting the likeness right",
      description:
        "Portraits in microrealism — likeness is settled in millimetres and contrast is built high from day one. Private studio in Almagro, Buenos Aires, since 2015.",
      heading: "Portraits in microrealism.",
      intro:
        "A portrait is decided in millimetres: the gap between eye and brow, the fall of the mouth corner, the width of the bridge of the nose. So I ask for a sharp photograph with even light, front or three-quarter — a blown-out or pixelated reference doesn't get fixed on skin, it gets inherited. There's also a minimum size below which a face stops being that face, and I'd rather tell you beforehand than after. Contrast gets built high from day one because grey softens with the years: a portrait that's exactly right today is washed out in a decade.",
    },
  },

  argentina: {
    es: {
      title: "Tatuajes argentinos: mate, fileteado e iconografía local",
      description:
        "Iconografía argentina tatuada en fineline: el fileteado, el mate, el hornero, la camiseta. Para los de acá y para los que se fueron y vuelven de visita.",
      heading: "Iconografía argentina.",
      intro:
        "Un mate, un filete, un hornero, una camiseta. El fileteado ya es una tradición de línea —guardas, hojas, remates— así que pasa al fineline casi sin traducción; el mate, en cambio, es más difícil de lo que parece, porque la calabaza tiene una textura opaca y la bombilla un brillo metálico y hay que resolver las dos cosas en pocos centímetros. Buena parte de estas piezas se las hago a gente que se fue del país y vuelve de visita, o a alguien que quiere llevarse algo de acá justo antes de irse.",
    },
    en: {
      title: "Argentine tattoos: mate, fileteado and homegrown imagery",
      description:
        "Argentine iconography in fineline — fileteado scrollwork, the mate, the hornero, the shirt. For people from here, and for the ones who left and come back.",
      heading: "Argentine iconography.",
      intro:
        "A mate, a fileteado scroll, a hornero, a football shirt. Fileteado is already a line tradition — scrollwork, leaves, flourishes — so it moves into fineline almost without translation; the mate is harder than it looks, because the gourd is matte and the bombilla is polished metal and both have to be solved inside a few centimetres. A good share of these are for people who left the country and come back to visit, or for someone who wants to take something from here with them right before they go.",
    },
  },

  dibujos: {
    es: {
      title: "Tatuajes tipo dibujo: trazo de lápiz y rayado a la vista",
      description:
        "Piezas donde el tatuaje no disimula que es un dibujo: líneas de construcción visibles, rayado en lugar de gris parejo y bordes que se abren en vez de cerrar.",
      heading: "Dibujos que siguen siendo dibujos.",
      intro:
        "Acá el tatuaje no disimula que es un dibujo: quedan las líneas de construcción, el rayado reemplaza al gris parejo y el borde se abre en vez de cerrarse. Es lo contrario del microrealismo, donde el trazo se esconde para que la imagen pase por una foto; en un dibujo el trazo es el tema. Funciona porque la piel ya tiene textura propia y acepta la marca suelta, casi de grafito, sin que se lea como un error.",
    },
    en: {
      title: "Sketch-style tattoos: pencil marks and visible hatching",
      description:
        "Pieces where the tattoo doesn't hide that it's a drawing — construction lines left in, hatching instead of even grey, and edges that open rather than close.",
      heading: "Drawings that stay drawings.",
      intro:
        "Here the tattoo doesn't hide that it's a drawing: construction lines stay in, hatching replaces even grey, and the edge opens instead of closing. It's the opposite of microrealism, where the stroke conceals itself so the image can pass for a photograph; in a drawing the stroke is the subject. It works because skin already has a texture of its own and takes a loose, almost graphite mark without it reading as a mistake.",
    },
  },

  peliculas: {
    es: {
      title: "Tatuajes de películas: un solo fotograma llevado a la piel",
      description:
        "Cine tatuado: elegir el fotograma es casi todo el diseño, y un objeto o una silueta suele funcionar mejor que la cara del protagonista. Gris suave, grano fino.",
      heading: "Un solo fotograma.",
      intro:
        "Una película dura dos horas y el tatuaje es un fotograma, así que elegir cuál es prácticamente todo el diseño. Casi siempre funciona mejor un objeto o una silueta que la cara del protagonista: un cartel, un auto, una mano —una cara ya es un retrato y trae otras exigencias. El grano y la luz baja del cine se llevan bien con el gris suave, y la prueba final es simple: alguien que vio la película tiene que reconocerla sin que se la expliquen.",
    },
    en: {
      title: "Film tattoos: a single frame of a film, carried onto skin",
      description:
        "Cinema tattooed — choosing the frame is most of the design, and an object or a silhouette usually beats the lead's face. Soft grey, fine grain, no captions.",
      heading: "A single frame.",
      intro:
        "A film runs two hours and the tattoo is one frame, so choosing which frame is most of the design. An object or a silhouette usually beats the lead's face — a sign, a car, a hand; a face is a portrait and arrives with its own demands. Film grain and low-key lighting sit well with soft grey. And the final test is simple: someone who has seen the film has to recognise it without being told what it is.",
    },
  },

  flashes: {
    es: {
      title: "Flashes: diseños ya dibujados y listos para ser tatuados",
      description:
        "Flashes disponibles: diseños dibujados de antemano, sin sesión de diseño y con el precio cerrado de entrada. Estudio privado en Almagro, Buenos Aires.",
      heading: "Diseños listos para tatuar.",
      intro:
        "Los flashes son diseños que ya están dibujados y esperan a alguien. No hay sesión de diseño ni ida y vuelta: elegís uno, acordamos tamaño y ubicación, y se tatúa tal cual está. Salen más rápido y el precio se sabe de entrada, así que suelen ser una buena primera pieza o la que entra en un hueco que te quedó. Los voy publicando en stories cuando abro fechas; algunos los repito, otros los tatúo una sola vez y los bajo.",
    },
    en: {
      title: "Flash tattoos: designs already drawn and ready to be taken",
      description:
        "Available flash — designs drawn ahead, no design session, price known upfront. Good as a first piece or a gap-filler. Private studio in Almagro, Buenos Aires.",
      heading: "Designs ready to take.",
      intro:
        "Flash are designs that are already drawn and waiting for someone. There's no design session and no back-and-forth: you pick one, we agree on size and placement, and it goes on as it is. They're quicker and the price is known upfront, which makes them a good first piece or the one that fills a gap you've been leaving. I post them in stories whenever I open dates; some I'll repeat, some get tattooed once and come down.",
    },
  },

  autos: {
    es: {
      title: "Tatuajes de autos y motos: chapa, cromo y reflejos en gris",
      description:
        "Autos y motos tatuados: proporciones que todo el mundo conoce de memoria y una carrocería que es, sobre todo, lo que refleja. Cromo en saltos duros de valor.",
      heading: "Chapa, cromo y reflejo.",
      intro:
        "Un auto es un objeto de superficie dura y de proporciones que todo el mundo conoce de memoria: si la línea del techo o el arco de la rueda se corren dos milímetros, cualquiera que tenga ese modelo lo ve enseguida. Y casi nada de lo que se dibuja es el auto en sí, sino lo que refleja: el cielo arriba, el asfalto abajo, la banda oscura del horizonte cruzando la puerta. El cromo se resuelve con saltos bruscos de valor y no con degradé, y casi siempre se trata de un auto en particular —el del padre, el primero, el que todavía está en el garage.",
    },
    en: {
      title: "Car tattoos: bodywork, chrome and reflection, all in grey",
      description:
        "Cars and bikes tattooed — proportions everyone already knows by heart, and a body panel that is mostly whatever it reflects. Chrome solved in hard value jumps.",
      heading: "Bodywork, chrome, reflection.",
      intro:
        "A car is a hard-surface object with proportions everyone already knows by heart: move the roofline or the wheel arch two millimetres and anyone who owns that model sees it immediately. And most of what you actually draw isn't the car, it's what the car reflects — sky above, asphalt below, the dark band of the horizon crossing the door. Chrome is solved with abrupt jumps in value rather than a gradient, and it's nearly always one particular car: a father's, a first one, the one still sitting in the garage.",
    },
  },

  personas: {
    es: {
      title: "Tatuajes de figuras humanas: cuerpos, manos y la postura",
      description:
        "Figuras, no caras: sin un parecido que sostener, el peso lo lleva la postura. Manos, espaldas y escultura clásica traducida de mármol a gris en la piel.",
      heading: "Figuras, no caras.",
      intro:
        "Son figuras, no caras: un cuerpo entero, una espalda, un par de manos. Al no haber un parecido que sostener, el peso lo lleva la postura —el apoyo de una cadera, la caída de una tela, la tensión de un brazo— y eso da muchísimo más margen que un retrato. Las manos son lo más difícil de dibujar que existe y son la mitad de lo que hay acá. Buena parte viene de escultura clásica, donde el volumen ya está resuelto en piedra y el trabajo es traducir el mármol a gris.",
    },
    en: {
      title: "Human figure tattoos: bodies, hands and posture in grey",
      description:
        "Figures, not faces: with no likeness to hold up, the weight falls on posture. Hands, backs, and classical sculpture translated from marble into grey on skin.",
      heading: "Figures, not faces.",
      intro:
        "These are figures, not faces: a whole body, a back, a pair of hands. With no likeness to hold up, the weight falls on posture — the set of a hip, the fall of cloth, the tension in an arm — and that leaves far more room than a portrait ever does. Hands are the hardest thing there is to draw and they're half of what's here. A good part of it comes out of classical sculpture, where the volume is already solved in stone and the job is translating marble into grey.",
    },
  },

  comida: {
    es: {
      title: "Tatuajes de comida: textura, brillo y algo de nostalgia",
      description:
        "Comida tatuada por textura: la miga de un pan, el vaho de una botella fría, el brillo graso de una porción. Es de los pocos temas donde el gris no molesta.",
      heading: "Comida con textura.",
      intro:
        "La comida se tatúa por textura o no se tatúa: la miga de un pan, el vaho en una botella fría, el brillo graso de una porción recién cortada. Es de los pocos temas donde el gris no molesta, porque todo el mundo sabe de qué color es un tomate y el cerebro lo completa solo. Suelen ser piezas con humor, o con una nostalgia muy concreta, y en Buenos Aires eso quiere decir medialunas, fernet y alguna milanesa.",
    },
    en: {
      title: "Food tattoos: texture, shine and very specific nostalgia",
      description:
        "Food tattooed through texture — the crumb of a loaf, the sweat on a cold bottle, the greasy shine on a slice. One of the few subjects greyscale never hurts.",
      heading: "Food, and its texture.",
      intro:
        "Food gets tattooed through texture or it doesn't get tattooed: the crumb of a loaf, the condensation on a cold bottle, the greasy shine on a freshly cut slice. It's one of the few subjects where greyscale costs nothing, because everyone already knows what colour a tomato is and the brain fills it in. These tend to be funny, or nostalgic in a very specific way, and in Buenos Aires that means medialunas, fernet and the occasional milanesa.",
    },
  },

  tarot: {
    es: {
      title: "Tatuajes de tarot: los arcanos mayores tatuados en fineline",
      description:
        "Tarot tatuado: la iconografía ya se lee sola, el problema es el formato. Con el marco de la carta o con la figura sacada de ella. Almagro, Buenos Aires.",
      heading: "Los arcanos mayores.",
      intro:
        "Los arcanos vienen con una iconografía fija que se lee sola: la Luna, la Torre, el Ermitaño y su farol. El problema real es el formato —una carta es un rectángulo con marco y con el nombre abajo, y ese rectángulo pelea contra el cuerpo—, así que hay que decidir si el marco se conserva como parte del tatuaje o si se saca la figura de la carta y se la deja respirar. La fuente es de por sí lineal, casi sin gris, y por eso es tan amable con el fineline. Y nadie elige una carta al azar: siempre están eligiendo lo que la carta dice de ellos.",
    },
    en: {
      title: "Tarot tattoos: the major arcana drawn in fineline detail",
      description:
        "Tarot tattooed — the iconography already reads on its own, the problem is format. With the card's frame kept, or the figure lifted out of it. Buenos Aires.",
      heading: "The major arcana.",
      intro:
        "The arcana arrive with a fixed iconography that reads on its own: the Moon, the Tower, the Hermit and his lantern. The real problem is format — a card is a bordered rectangle with its name underneath, and that rectangle fights the body — so the decision is whether the frame stays as part of the tattoo or the figure gets lifted out of the card and left to breathe. The source is linear to begin with, nearly greyless, which is exactly why it's so friendly to fineline. And nobody picks a card at random: they're always picking what the card says about them.",
    },
  },

  playmobil: {
    es: {
      title: "Tatuajes de Playmobil: el plástico, el molde y el brillo",
      description:
        "Playmobil tatuado: la figura ya viene diseñada, así que el realismo se va entero al plástico —la línea del molde, el brillo duro, las rayaduras del uso.",
      heading: "Plástico, molde y brillo.",
      intro:
        "Un Playmobil ya viene diseñado: cabeza redonda, proporciones fijas, manos en forma de C, esa sonrisa pintada que no cambia nunca. No queda nada por simplificar, así que el realismo se va entero al plástico —la línea del molde, el brillo duro sobre el casco, las rayaduras de un muñeco con el que efectivamente se jugó. Casi siempre es una figura puntual de la infancia de alguien, y ese detalle gastado es justamente el punto.",
    },
    en: {
      title: "Playmobil tattoos: the plastic, the mould seam, the shine",
      description:
        "Playmobil tattooed: the figure arrives pre-designed, so all the realism goes into the plastic — the mould seam, the hard highlight, the scuffs of actual use.",
      heading: "Plastic, mould and shine.",
      intro:
        "A Playmobil figure arrives pre-designed: round head, fixed proportions, hands shaped like a C, that painted smile that never changes. There's nothing left to simplify, so the realism goes entirely into the plastic — the mould seam, the hard highlight across the helmet, the scuffing on a toy that actually got played with. It's nearly always one specific figure from somebody's childhood, and that worn detail is exactly the point.",
    },
  },
};

/**
 * Slugs with copy, in the order they should appear.
 * Anything not here is not given a page.
 *
 * Order: the featured selection first (it is the best entry point for someone
 * who has never seen the work), then the remaining subjects roughly by how much
 * work each holds, which matches the order of the /work archive.
 */
export const CATEGORY_SLUGS: string[] = [
  "best-tattoos",
  "arte",
  "botanica",
  "minis",
  "animales",
  "compo",
  "anatom",
  "musica",
  "retratos",
  "argentina",
  "dibujos",
  "peliculas",
  "flashes",
  "autos",
  "personas",
  "comida",
  "tarot",
  "playmobil",
];
