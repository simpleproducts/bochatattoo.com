/**
 * The admin area's own dictionary — operator UI, never client-facing copy.
 *
 * Deliberately SEPARATE from `Dictionary` in ./types.ts. That one is marketing
 * and booking copy a visitor reads; this one is the language of the person
 * running the studio. Merging them would ship every admin string into the
 * public bundle for no reader, and would make one file answer to two very
 * different tones.
 *
 * The parity mechanism is the same one the public dictionaries use and the
 * only one there is: both constants below are annotated `AdminDictionary`, so
 * a key added to one and forgotten in the other fails `tsc` rather than
 * shipping a hole. Nothing here is optional for that reason.
 *
 * Where a string needs a runtime value it carries a `{placeholder}` in the
 * house style (see `footer.rights`'s `{year}`), replaced by the caller with a
 * plain `.replace()`. There is no interpolation library and there must not be.
 *
 * Two rules the Spanish follows, so a later hand can extend it in the same
 * voice:
 *
 *  1. Voseo, warm but spare. A button that COMMITS the operator's own input is
 *     an imperative — "Guardá", "Agregá", "Creá", "Subí", "Reintentá". Every
 *     other control — destructive, secondary, navigational — is the plain
 *     infinitive: "Cancelar", "Eliminar", "Editar", "Cerrar", "Salir".
 *  2. Short. Most of these live in fixed-width chips, a tab bar, or 10px mono
 *     uppercase micro-labels; a Spanish string half again as long as its
 *     English twin breaks a row that has no slack. Where the English is a
 *     micro-label the Spanish is one too.
 *
 * The locale itself is a cookie, not a URL segment — see src/lib/admin-locale.ts
 * for why the admin cannot do what the public site does.
 */
import type { Locale } from "./config";

export type AdminDictionary = {
  /**
   * The four tabs in AdminNav. Also the h1 of the page each one leads to —
   * except Settings, whose page heads itself with `settings.title`, because a
   * tab has room for one word and that page's heading says a little more.
   */
  nav: {
    calendar: string;
    images: string;
    categories: string;
    settings: string;
  };

  /**
   * Words that appear on more than one surface. Anything used twice belongs
   * here rather than being spelled out again under a second key — five
   * separate "Cancel"s are five chances to translate it five ways.
   */
  common: {
    /** The eyebrow on the login form and the h1 of the image library. */
    admin: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    retry: string;
    /** Sentence-case, standalone. */
    loading: string;
    saving: string;
    /** Lowercase: these two sit inline beside a heading, not on a button. */
    working: string;
    refreshing: string;
    signOut: string;
    /** Destructive answer on the discard dialog. */
    discard: string;
    search: string;
    category: string;
    /** Feminine in Spanish — it only ever describes an imagen or a categoría. */
    hidden: string;
    name: string;
    email: string;
    phone: string;
    instagram: string;
    deposit: string;
    /** Accessible name of the ES · EN pair. */
    language: string;
    /** File sizes. `{size}` is already rounded by the caller. */
    kilobytes: string;
    megabytes: string;
  };

  gallery: {
    /**
     * The header tally. `counts` composes two already-resolved clauses, the
     * same way `calendar.reindex.done` does, because the two numbers vary
     * independently: one image in three categories and one category holding
     * three images are both ordinary states, and a single plural-or-not
     * variant of the whole sentence could express neither.
     */
    counts: string;
    /** "{count} images" / "{count} image" */
    images: string;
    imagesOne: string;
    categories: string;
    categoriesOne: string;
    allCategories: string;
    /** The pseudo-bucket for images with no category set. */
    uncategorized: string;
    /** The "no category" option inside one image's category select. */
    noCategory: string;
    searchPlaceholder: string;
    noMatch: string;
    /** confirm() before a destructive delete. `{slug}` is the image. */
    deleteTitle: string;
    confirmDelete: string;
  };

  uploader: {
    uploadTo: string;
    /** Shown in the select when no category exists to upload into yet. */
    noCategories: string;
    /** alert() when files are dropped before a category is chosen. */
    pickCategoryAlert: string;
    /** The same refusal, inline in the drop zone. */
    pickCategoryHint: string;
    drag: string;
    /** Replaces `drag` while a file is over the zone. */
    drop: string;
    orClick: string;
    /** `{max}` is MAX_BYTES in whole MB. */
    formats: string;
    /** Rejected before any request goes out. `{size}` and `{max}` are MB. */
    tooLarge: string;
    /** The per-file `[state]` chip. Lowercase — it is a machine state. */
    status: {
      idle: string;
      uploading: string;
      processing: string;
      done: string;
      error: string;
    };
    /**
     * Which leg of the three-step upload failed, prefixed to whatever the
     * server said. `{detail}` is a raw server message and is never translated.
     */
    errors: {
      init: string;
      put: string;
      finalize: string;
    };
  };

  categories: {
    newSlug: string;
    /** An example slug, not a word — identical in both languages. */
    slugPlaceholder: string;
    esLabel: string;
    enLabel: string;
    columns: {
      slug: string;
      /** The two label columns, headed by the locale code itself. */
      es: string;
      en: string;
      order: string;
    };
    /** confirm() before deleting. `{slug}` is the category. */
    deleteTitle: string;
    confirmDelete: string;
  };

  calendar: {
    /**
     * The header tally: "{appointments} · {pending}", both clauses already
     * resolved by the caller. Composed rather than one sentence for the same
     * reason as `gallery.counts` — the total and the pending count vary
     * independently. The left clause is `appointments`/`appointmentsOne`
     * below; only the right one needs new words.
     */
    counts: string;
    /**
     * "{count} awaiting" / "{count} pendiente". English does not inflect here,
     * so its twin is deliberately identical to its plural; Spanish does.
     */
    pending: string;
    pendingOne: string;
    /**
     * Shown instead of the calendar when R2_PRIVATE_BUCKET or
     * BOOKING_TOKEN_SECRET is missing. `body` carries three placeholders —
     * `{privateBucket}`, `{bucket}`, `{secret}` — replaced at render by mono
     * spans, the same way `booking.done.body` is replaced by anchors, so each
     * language keeps its own word order.
     */
    notConfigured: { title: string; body: string };
    /** The strip that appears when a write route could not update its index. */
    indexWarning: string;
    /**
     * The month-index repair. `done` composes `months` and `bookings`, each of
     * which has a singular twin: there is no plural engine here, and a count
     * of one is the only irregular case either language has.
     */
    reindex: {
      label: string;
      busy: string;
      /** "{count} months" / "{count} month" */
      months: string;
      monthsOne: string;
      bookings: string;
      bookingsOne: string;
      /** "Rebuilt {months} · {bookings}." */
      done: string;
    };
    /**
     * The two failures the calendar composes itself. Server error codes are
     * NOT here — those arrive already humanised from the API via readError().
     */
    errors: {
      noAppointment: string;
      invalidSlot: string;
    };
    /** "{count} appointments" / "{count} appointment", shared by grid + agenda. */
    appointments: string;
    appointmentsOne: string;
    toolbar: {
      prevMonth: string;
      nextMonth: string;
      today: string;
      /** Accessible name of the month/agenda tab pair. */
      viewLabel: string;
      /** The tab labels themselves. Lowercase; CSS uppercases them. */
      views: { month: string; agenda: string };
      new: string;
      /** "Times shown in {tz}" — the IANA zone, with its abbrev appended after. */
      timezone: string;
      /** Accessible name for the timezone <select>. */
      timezoneLabel: string;
      /** Option that follows the browser's own zone. */
      timezoneAuto: string;
      /** Option pinned to the studio's zone. */
      timezoneStudio: string;
      /** optgroup heading over the full IANA list. */
      /** optgroup headings over the curated, de-duplicated zone list. */
      timezoneAmericas: string;
      timezoneEurope: string;
      legend: string;
    };
    grid: {
      /** Accessible name of the 42-cell grid. */
      label: string;
      /** Monday first: the studio is in Argentina. Exactly seven, short form. */
      weekdays: [string, string, string, string, string, string, string];
      /**
       * The three shapes of a day cell's aria-label. `{date}` is a formatted
       * day, `{count}` is `appointments`/`appointmentsOne` already resolved,
       * `{pending}` is a bare number.
       */
      cellEmpty: string;
      cell: string;
      cellPending: string;
      /** The "+N" control, which expands the cell rather than opening a composer. */
      showAll: string;
      showFewer: string;
      less: string;
      loading: string;
      empty: string;
      createOne: string;
    };
    agenda: {
      /** "{day} — {count}", the week strip's per-day accessible name. */
      dayLabel: string;
      empty: string;
      new: string;
    };
    /**
     * The admin's word for each derived status, keyed by STATUS_META's
     * `dictKey`. Mono uppercase everywhere they appear, so both languages stay
     * inside the width a legend row and an agenda row can give them.
     */
    status: {
      pending: string;
      awaitingReceipt: string;
      confirmed: string;
      cancelled: string;
    };
    sheet: {
      newTitle: string;
      editTitle: string;
      /** Heading when the sheet is open on an id it could not resolve. */
      fallbackTitle: string;
      /** confirm() on closing a form with unsaved edits. Two lines, \n\n apart. */
      /** Heading of the discard dialog; discardConfirm is its body. */
      discardTitle: string;
      discardConfirm: string;
      /**
       * confirm() before the irreversible delete. It names the reversible
       * alternative in prose — keep that phrase in step with `cancelBooking`.
       */
      deleteTitle: string;
      deleteConfirm: string;
      notLoaded: string;
      loadingOne: string;
      loadFailed: string;
      /** Label before a timestamp, not a sentence. */
      created: string;
      /** The details the studio filled in before the link was sent. */
      seed: string;
      client: string;
      message: string;
      /** Both label a timestamp or its absence. */
      termsAccepted: string;
      termsPending: string;
      notes: string;
      restore: string;
      cancelBooking: string;
    };
    form: {
      date: string;
      starts: string;
      lasts: string;
      /** Accessible name of the duration chip row. */
      duration: string;
      ends: string;
      nextDay: string;
      /**
       * The appointment's OWN zone — the clock of the place the session
       * happens in, which is not the clock the calendar is being read in. The
       * label asks WHERE, because that is the question the operator is really
       * answering: a week of guest-spot bookings in Berlin is one zone set
       * once, and the wall-clock times above are that zone's, not the
       * reader's.
       */
      timeZone: string;
      /** Sits under the field. Says which times the zone governs — the ones above it. */
      timeZoneHint: string;
      /**
       * The two shortcuts at the head of the zone list, for the only two zones
       * the operator picks without thinking. `{tz}` is the IANA zone each one
       * resolves to, so the option still names the clock it is choosing.
       */
      timeZoneStudio: string;
      timeZoneCurrent: string;
      /**
       * The marker beside an appointment whose zone is not the calendar's
       * current one. `{abbrev}` is a short zone label (CEST, GMT+2) and never
       * a city: this renders inside a mono chip in an agenda row that has no
       * slack, so the whole string has to stay near eight characters.
       */
      timeZoneChip: string;
      /** The server refused the zone — it is not an IANA name it recognises. */
      timeZoneInvalid: string;
      /** The chip that reveals an end time instead of setting one. */
      chipCustom: string;
      endBeforeStart: string;
      /** A warning, never a block. "{range} · {name}" is the other booking. */
      overlap: string;
      /** Micro-hint under the email field; turns red only after a failed submit. */
      contactHint: string;
      /** Caption over the Instagram+Email pair. Must read as "one of these two". */
      contactGroup: string;
      /** The same rule as a full sentence, once submit has been refused. */
      contactRequired: string;
      depositCurrency: string;
      /** Teaches the two accepted grammars by example — leave the numbers. */
      invalidAmount: string;
      notes: string;
      notesHint: string;
      /** The submit button, one label per mode. */
      create: string;
      saveChanges: string;
    };
    link: {
      title: string;
      /** "{locale}" is the link's own language code, upper-cased by the caller. */
      inputLabel: string;
      copy: string;
      copied: string;
      share: string;
      /** A product name — identical in both languages. */
      whatsapp: string;
      rotate: string;
      /** confirm(): rotating kills every link already sent. */
      rotateTitle: string;
      rotateConfirm: string;
    };
    receipt: {
      title: string;
      empty: string;
      /** A format name, not a word. */
      pdf: string;
      /** alt text for the uploaded image. `{filename}` as the client sent it. */
      imageAlt: string;
      /**
       * The studio attaching the proof itself. Clients send it by WhatsApp at
       * least as often as they upload it, and a comprobante sitting in a chat
       * is one the booking does not have — this control puts it on the record,
       * and confirms the booking exactly as the client's own upload would.
       */
      upload: string;
      uploading: string;
      uploadFailed: string;
      delete: string;
      /** confirm(). `{status}` is `status.awaitingReceipt` — the state it falls back to. */
      deleteTitle: string;
      deleteConfirm: string;
    };
    /** The four transactional emails, keyed by BookingEmailKind. */
    emails: {
      heading: string;
      ownerSubmitted: string;
      clientSubmitted: string;
      ownerConfirmed: string;
      clientConfirmed: string;
      notSent: string;
      resend: string;
    };
  };

  /**
   * Guest spots. A trip is a named date range saying "these days I am in
   * Berlin", and it does exactly two jobs: it PROPOSES (a new appointment on
   * one of those days opens already set to that zone) and it QUESTIONS (a
   * booking on one of those days whose zone is not the trip's gets a warning).
   * It never rewrites a booking, so nothing here may read as a rule the
   * operator broke — the zone on the appointment is still the truth, and the
   * operator is often right.
   */
  trips: {
    /** The toolbar control that opens the panel, beside `toolbar.new`. */
    manage: string;
    /** The panel's own heading. */
    title: string;
    /**
     * Shown while no trip exists. Nobody has used this feature before, so the
     * line teaches what a trip is FOR instead of reporting an empty list.
     */
    empty: string;
    /** The panel form's heading, one per mode — same pair as `sheet`. */
    newTrip: string;
    editTrip: string;
    /**
     * Field labels. The name field reuses `common.name`: it is the same word
     * on the same kind of input, and a second "Nombre" here would only be a
     * second chance to translate it differently. Its placeholder is a city,
     * not a word, so it is identical in both languages — like
     * `categories.slugPlaceholder`.
     */
    namePlaceholder: string;
    /** Short: the panel packs four fields into one narrow row. */
    timeZone: string;
    from: string;
    to: string;
    /**
     * Accessible names for the per-row controls, which repeat down the list
     * and are too small to carry a word. `{label}` is the trip.
     */
    editOne: string;
    deleteOne: string;
    /**
     * ConfirmDialog before deleting. The body's whole job is to say that no
     * booking moves: deleting a trip retires a default and a warning, nothing
     * else. Adding or moving a trip is just as harmless, which is why only the
     * destructive control asks at all.
     */
    deleteTitle: string;
    deleteConfirm: string;
    /**
     * The band drawn across every day a trip covers. It renders INSIDE a month
     * cell, above the appointment chips, so it gets the label and one glyph
     * and nothing more. `{label}` is the trip's own.
     */
    band: string;
    /**
     * The booking form's mismatch warning: the date falls inside a trip but
     * the chosen zone is not the trip's. Same treatment as `form.overlap` —
     * visible, explicit, never blocking — and phrased as a question, because a
     * remote consult or a session booked for after the trip ends is a perfectly
     * good answer. `{trip}` is the label, `{tz}` the zone the booking is in.
     */
    zoneMismatch: string;
    /**
     * What the trips routes refuse, keyed by the `error` code each one returns
     * so the panel can print words instead of the wire message.
     */
    errors: {
      invalidRange: string;
      /** `{max}` is TRIP_LABEL_MAX. */
      labelTooLong: string;
      invalidTimeZone: string;
    };
  };

  /**
   * The fourth tab: everything the studio can change without a deploy — who
   * its mail comes from, whether a bank transfer is offered and with which
   * numbers, whether MercadoPago is offered at all, and where the studio is.
   *
   * That last one is the only field here that is not about money, and the only
   * one whose whole point is who does NOT get to read it: see `hints.studio`.
   *
   * No secret is named here and none may be. The Brevo key and the MercadoPago
   * access token live in the hosting environment, which is the whole reason
   * `hints.mercadopago` exists: a bare toggle would read as "turn MercadoPago
   * on", and this screen cannot do that on its own.
   *
   * The tab's own label is `nav.settings`, with the other three, because
   * AdminNav looks its labels up by tab key.
   */
  settings: {
    /** The page h1. */
    title: string;
    /** After a successful PUT — inline beside the save button, not a dialog. */
    saved: string;
    /** The PUT was refused or never arrived. Nothing was written. */
    saveFailed: string;
    /** The four groups the form is split into. */
    sections: {
      email: string;
      transfer: string;
      mercadopago: string;
      studio: string;
    };
    /**
     * Field labels. The bank block reuses the client page's words on purpose —
     * alias, CBU, titular, banco are what the operator will read back off a
     * home-banking screen while copying them in.
     */
    fields: {
      senderEmail: string;
      senderName: string;
      notifyEmail: string;
      alias: string;
      cbu: string;
      holder: string;
      bank: string;
      address: string;
      arrivalNote: string;
    };
    /**
     * The two "offer this method" switches. Phrased as what the CLIENT is
     * given rather than as a feature flag, because that is what turning one
     * off does: it removes a choice from the booking page.
     */
    toggles: {
      transfer: string;
      mercadopago: string;
    };
    /**
     * Sits with the section it explains. Three sections need one: the email
     * fields, where empty is a meaningful value and not an omission;
     * MercadoPago, where the toggle is only half of what turns it on; and the
     * studio address, for the reason `studio` spells out below.
     */
    hints: {
      email: string;
      mercadopago: string;
      /**
       * THE ANSWER TO "DOES TYPING THIS PUBLISH MY ADDRESS?", and the reason it
       * is a string in the dictionary rather than a comment in the code: the
       * person who will ask it is the operator staring at an empty box, not a
       * reader of this file. It has to name the audience (a client whose
       * booking is CONFIRMED), the two places it appears (their private page,
       * their confirmation email), and the place it never does (the public
       * site) — because a hint that only reassures, without saying what the
       * condition is, is not something an operator can check.
       *
       * Rendered ABOVE the inputs, not under them: it is read before typing.
       */
      studio: string;
      /** What belongs in the arrival note, since "note" alone says nothing. */
      arrivalNote: string;
    };
    /**
     * What the form refuses before it ever sends. `invalidCbu` names the
     * length in full: a CBU (and a CVU) is 22 digits, always, so "the right
     * length" is a number the operator can count against what they pasted.
     */
    errors: {
      invalidEmail: string;
      invalidCbu: string;
    };
  };

  login: {
    title: string;
    password: string;
    /** The only login failure the page distinguishes. */
    wrongPassword: string;
    submit: string;
  };

  /**
   * The home-screen install offer at the foot of the calendar — see
   * InstallPrompt.tsx. Four strings, because there are two entirely different
   * routes to an install and one way out of both: `action` is the button that
   * replays Chrome's captured prompt, `ios` is the share-sheet instruction
   * Safari leaves as the only alternative, and `dismiss` retires the bar for
   * good.
   *
   * `ios` names the two rows to tap in the words iOS itself uses in that
   * language, because the operator is matching this sentence against his own
   * share sheet.
   */
  install: {
    title: string;
    action: string;
    ios: string;
    dismiss: string;
  };
};

const adminEs: AdminDictionary = {
  nav: {
    calendar: "Calendario",
    images: "Imágenes",
    categories: "Categorías",
    settings: "Ajustes",
  },

  common: {
    admin: "Admin",
    save: "Guardá",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Agregá",
    close: "Cerrar",
    retry: "Reintentá",
    loading: "Cargando…",
    saving: "Guardando…",
    working: "trabajando…",
    refreshing: "actualizando…",
    signOut: "Salir",
    discard: "Descartar",
    search: "Buscar",
    category: "Categoría",
    hidden: "Oculta",
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    instagram: "Instagram",
    deposit: "Seña",
    language: "Idioma",
    kilobytes: "{size} KB",
    megabytes: "{size} MB",
  },

  gallery: {
    counts: "{images} · {categories}",
    images: "{count} imágenes",
    imagesOne: "{count} imagen",
    categories: "{count} categorías",
    categoriesOne: "{count} categoría",
    allCategories: "Todas las categorías",
    uncategorized: "(sin categoría)",
    noCategory: "(ninguna)",
    searchPlaceholder: "slug o texto alt",
    noMatch: "No hay imágenes que coincidan.",
    deleteTitle: "¿Eliminar la imagen?",
    confirmDelete: "¿Eliminar {slug}? Se borran las variantes de R2.",
  },

  uploader: {
    uploadTo: "Subir a la categoría",
    noCategories: "(creá una categoría primero)",
    pickCategoryAlert: "Elegí una categoría primero.",
    pickCategoryHint: "Elegí una categoría arriba",
    drag: "Arrastrá las imágenes acá",
    drop: "Soltá para subir",
    orClick: "o tocá para elegir archivos",
    formats:
      "jpg · png · webp · avif · heic · tiff — hasta {max} MB c/u · multiselección OK",
    tooLarge: "muy grande ({size} MB > {max} MB)",
    status: {
      idle: "en espera",
      uploading: "subiendo",
      processing: "procesando",
      done: "listo",
      error: "error",
    },
    errors: {
      init: "inicio: {detail}",
      put: "subida: {detail}",
      finalize: "cierre: {detail}",
    },
  },

  categories: {
    newSlug: "Slug nuevo",
    slugPlaceholder: "best-tattoos",
    esLabel: "Nombre ES",
    enLabel: "Nombre EN",
    columns: {
      slug: "Slug",
      es: "ES",
      en: "EN",
      order: "Orden",
    },
    deleteTitle: "¿Eliminar la categoría?",
    confirmDelete: '¿Eliminar la categoría "{slug}"?',
  },

  calendar: {
    counts: "{appointments} · {pending}",
    pending: "{count} pendientes",
    pendingOne: "{count} pendiente",
    notConfigured: {
      title: "Reservas sin configurar",
      body:
        "Configurá {privateBucket} (un segundo bucket de R2, no público — no " +
        "puede ser el mismo valor que {bucket}) y {secret} en el entorno, y " +
        "volvé a deployar. Hasta que estén las dos, el calendario no puede " +
        "leer ni firmar nada.",
    },
    indexWarning:
      "Falló la escritura de un índice mensual. Puede faltar un turno en este " +
      "calendario aunque su link privado siga andando — reconstruí el índice.",
    reindex: {
      label: "Reparar índice",
      busy: "Reparando…",
      months: "{count} meses",
      monthsOne: "{count} mes",
      bookings: "{count} turnos",
      bookingsOne: "{count} turno",
      done: "Se reconstruyeron {months} · {bookings}.",
    },
    errors: {
      noAppointment: "La API de turnos no devolvió ningún turno.",
      invalidSlot: "Fecha, hora o monto inválidos.",
    },
    appointments: "{count} turnos",
    appointmentsOne: "{count} turno",
    toolbar: {
      prevMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
      today: "Hoy",
      viewLabel: "Vista del calendario",
      views: { month: "mes", agenda: "lista" },
      new: "+ Nuevo",
      timezoneLabel: "Zona horaria",
      timezoneAuto: "Mi zona ({tz})",
      timezoneStudio: "Estudio ({tz})",
      timezoneAmericas: "América",
      timezoneEurope: "Europa",
      timezone: "Horarios en {tz}",
      legend: "Referencias",
    },
    grid: {
      label: "Turnos por día",
      weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      cellEmpty: "{date} — sin turnos",
      cell: "{date} — {count}",
      cellPending: "{date} — {count}, {pending} esperando cliente",
      showAll: "Ver los {count} turnos del {date}",
      showFewer: "Ver menos turnos del {date}",
      less: "Menos",
      loading: "Cargando turnos…",
      empty: "No hay turnos este mes.",
      createOne: "Creá uno",
    },
    agenda: {
      dayLabel: "{day} — {count}",
      empty: "No hay nada agendado.",
      new: "+ Turno nuevo",
    },
    status: {
      pending: "ESPERANDO CLIENTE",
      awaitingReceipt: "ESPERANDO COMPROBANTE",
      confirmed: "CONFIRMADO",
      cancelled: "CANCELADO",
    },
    sheet: {
      newTitle: "Turno nuevo",
      editTitle: "Editar turno",
      fallbackTitle: "Turno",
      discardTitle: "¿Descartar los cambios?",
      discardConfirm:
        "¿Descartar los cambios de este turno?\n\nTodavía no se guardó nada.",
      deleteTitle: "¿Eliminar el turno?",
      deleteConfirm:
        "¿Eliminar este turno para siempre?\n\nSe borran el registro y el " +
        "comprobante, y el link deja de andar. Si solo querés liberar el " +
        "horario, usá Cancelar turno — eso se puede deshacer.",
      notLoaded: "Este turno ya no está cargado.",
      loadingOne: "Cargando este turno…",
      loadFailed: "No se pudo cargar este turno.",
      created: "Creado",
      seed: "Datos del estudio",
      client: "Cliente",
      message: "Mensaje",
      termsAccepted: "Términos aceptados",
      termsPending: "Términos sin aceptar",
      notes: "Notas privadas",
      restore: "Restaurar",
      cancelBooking: "Cancelar turno",
    },
    form: {
      date: "Fecha",
      starts: "Empieza",
      lasts: "Dura",
      duration: "Duración",
      ends: "Termina",
      nextDay: "Día siguiente",
      timeZone: "Zona horaria del turno",
      timeZoneHint:
        "La zona donde es el turno — los horarios de arriba son de ahí.",
      timeZoneStudio: "Igual que el estudio ({tz})",
      timeZoneCurrent: "Mi zona actual ({tz})",
      timeZoneChip: "en {abbrev}",
      timeZoneInvalid: "Zona horaria inválida — elegí otra.",
      chipCustom: "otro",
      endBeforeStart: "El fin tiene que ser después del inicio",
      overlap: "⚠ Se pisa con {range} · {name}",
      contactHint: "Al menos uno",
      contactGroup: "Contacto — completá al menos uno de los dos",
      contactRequired:
        "Agregá un Instagram o un email — hace falta al menos uno.",
      depositCurrency: "Moneda de la seña",
      invalidAmount: "Monto inválido — 50.000 o 50000,50",
      notes: "Notas",
      notesHint: "Privadas — el cliente nunca las ve.",
      create: "Creá el turno",
      saveChanges: "Guardá los cambios",
    },
    link: {
      title: "Link privado",
      inputLabel: "Link privado del turno ({locale})",
      copy: "Copiar",
      copied: "Copiado ✓",
      share: "Compartir",
      whatsapp: "WhatsApp",
      rotate: "Rotar link",
      rotateTitle: "¿Generar un link nuevo?",
      rotateConfirm:
        "¿Rotar este link?\n\nTodos los links que ya mandaste para este turno " +
        "dejan de funcionar al instante — WhatsApp, mail, lo que sea. Vas a " +
        "tener que mandar el nuevo.",
    },
    receipt: {
      title: "Comprobante",
      empty: "Todavía no subió nada.",
      pdf: "PDF",
      imageAlt: "Comprobante de transferencia: {filename}",
      upload: "Subí un comprobante",
      uploading: "Subiendo…",
      uploadFailed: "No se pudo subir el comprobante.",
      delete: "Eliminar comprobante",
      deleteTitle: "¿Eliminar el comprobante?",
      deleteConfirm:
        "¿Eliminar este comprobante?\n\nEl archivo se borra del storage y el " +
        "turno vuelve a {status}, así el cliente puede subir otro.",
    },
    emails: {
      heading: "Emails",
      ownerSubmitted: "Estudio · enviado",
      clientSubmitted: "Cliente · enviado",
      ownerConfirmed: "Estudio · confirmado",
      clientConfirmed: "Cliente · confirmado",
      notSent: "sin enviar",
      resend: "Reenviar",
    },
  },

  trips: {
    manage: "Viajes",
    title: "Viajes",
    empty:
      "Todavía no hay viajes. Un viaje marca los días que estás en otra " +
      "ciudad: los turnos de esas fechas arrancan en esa zona y te avisa si " +
      "alguno quedó en otra.",
    newTrip: "Viaje nuevo",
    editTrip: "Editar viaje",
    namePlaceholder: "Berlín",
    timeZone: "Zona",
    from: "Desde",
    to: "Hasta",
    editOne: "Editar {label}",
    deleteOne: "Eliminar {label}",
    deleteTitle: "¿Eliminar el viaje?",
    deleteConfirm:
      "¿Eliminar \"{label}\"?\n\nNingún turno cambia: los que ya están hechos " +
      "se quedan con su zona. Solo se pierden la zona por defecto y el aviso " +
      "de los próximos.",
    band: "✈ {label}",
    zoneMismatch:
      "⚠ Estás en {trip} ese día, pero el turno quedó en {tz}. ¿Va así?",
    errors: {
      invalidRange: "Fechas inválidas — el fin no puede ser antes del inicio.",
      labelTooLong: "El nombre no puede pasar de {max} caracteres.",
      invalidTimeZone: "Zona horaria del viaje inválida — elegí otra.",
    },
  },

  settings: {
    title: "Ajustes del estudio",
    saved: "Ajustes guardados ✓",
    saveFailed: "No se pudieron guardar los ajustes.",
    sections: {
      email: "Emails",
      transfer: "Transferencia bancaria",
      mercadopago: "MercadoPago",
      studio: "Dirección del estudio",
    },
    fields: {
      senderEmail: "Dirección del remitente",
      senderName: "Nombre del remitente",
      notifyEmail: "Avisos a",
      alias: "Alias",
      cbu: "CBU",
      holder: "Titular",
      bank: "Banco",
      address: "Dirección",
      arrivalNote: "Indicaciones de llegada",
    },
    toggles: {
      transfer: "Ofrecer transferencia bancaria",
      mercadopago: "Ofrecer MercadoPago",
    },
    hints: {
      email: "Si lo dejás vacío se usa la dirección del sitio.",
      mercadopago:
        "El access token de MercadoPago se configura en el entorno del " +
        "hosting, no acá.",
      studio:
        "Esto lo ve únicamente el cliente que ya tiene el turno confirmado " +
        "—términos aceptados y seña acreditada—, en su página privada y en el " +
        "mail de confirmación. Nunca aparece en el sitio público. Si lo dejás " +
        "vacío, no se muestra ninguna dirección.",
      arrivalNote:
        "Timbre, piso, la esquina más cercana — lo que ayude a llegar a la puerta.",
    },
    errors: {
      invalidEmail: "Esa dirección de email no es válida.",
      invalidCbu: "El CBU tiene que tener 22 dígitos.",
    },
  },

  login: {
    title: "Iniciar sesión",
    password: "Contraseña",
    wrongPassword: "Contraseña incorrecta.",
    submit: "Entrar",
  },

  install: {
    title: "Agregá el admin a la pantalla de inicio",
    action: "Instalá",
    ios: "Tocá Compartir y después «Agregar a pantalla de inicio».",
    dismiss: "No mostrar más",
  },
};

const adminEn: AdminDictionary = {
  nav: {
    calendar: "Calendar",
    images: "Images",
    categories: "Categories",
    settings: "Settings",
  },

  common: {
    admin: "Admin",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    close: "Close",
    retry: "Retry",
    loading: "Loading…",
    saving: "Saving…",
    working: "working…",
    refreshing: "refreshing…",
    signOut: "Sign out",
    discard: "Discard",
    search: "Search",
    category: "Category",
    hidden: "Hidden",
    name: "Name",
    email: "Email",
    phone: "Phone",
    instagram: "Instagram",
    deposit: "Deposit",
    language: "Language",
    kilobytes: "{size} KB",
    megabytes: "{size} MB",
  },

  gallery: {
    counts: "{images} · {categories}",
    images: "{count} images",
    imagesOne: "{count} image",
    categories: "{count} categories",
    categoriesOne: "{count} category",
    allCategories: "All categories",
    uncategorized: "(uncategorized)",
    noCategory: "(none)",
    searchPlaceholder: "slug or alt text",
    noMatch: "No images match.",
    deleteTitle: "Delete this image?",
    confirmDelete: "Delete {slug}? This deletes the variants from R2.",
  },

  uploader: {
    uploadTo: "Upload to category",
    noCategories: "(create a category first)",
    pickCategoryAlert: "Pick a category first.",
    pickCategoryHint: "Pick a category above first",
    drag: "Drag images here",
    drop: "Drop to upload",
    orClick: "or click to choose files",
    formats:
      "jpg · png · webp · avif · heic · tiff — up to {max} MB each · multi-select OK",
    tooLarge: "too-large ({size} MB > {max} MB)",
    status: {
      idle: "idle",
      uploading: "uploading",
      processing: "processing",
      done: "done",
      error: "error",
    },
    errors: {
      init: "init: {detail}",
      put: "put: {detail}",
      finalize: "finalize: {detail}",
    },
  },

  categories: {
    newSlug: "New slug",
    slugPlaceholder: "best-tattoos",
    esLabel: "ES label",
    enLabel: "EN label",
    columns: {
      slug: "Slug",
      es: "ES",
      en: "EN",
      order: "Order",
    },
    deleteTitle: "Delete this category?",
    confirmDelete: 'Delete category "{slug}"?',
  },

  calendar: {
    counts: "{appointments} · {pending}",
    pending: "{count} awaiting",
    pendingOne: "{count} awaiting",
    notConfigured: {
      title: "Bookings not configured",
      body:
        "Set {privateBucket} (a second, non-public R2 bucket — it must not be " +
        "the same value as {bucket}) and {secret} in the environment, then " +
        "redeploy. Until both are present the calendar cannot read or sign " +
        "anything.",
    },
    indexWarning:
      "A month index write failed. A booking can be missing from this calendar " +
      "while its private link still works — rebuild the index.",
    reindex: {
      label: "Repair index",
      busy: "Repairing…",
      months: "{count} months",
      monthsOne: "{count} month",
      bookings: "{count} bookings",
      bookingsOne: "{count} booking",
      done: "Rebuilt {months} · {bookings}.",
    },
    errors: {
      noAppointment: "The booking API returned no appointment.",
      invalidSlot: "Invalid date, time or amount.",
    },
    appointments: "{count} appointments",
    appointmentsOne: "{count} appointment",
    toolbar: {
      prevMonth: "Previous month",
      nextMonth: "Next month",
      today: "Today",
      viewLabel: "Calendar view",
      views: { month: "month", agenda: "agenda" },
      new: "+ New",
      timezoneLabel: "Time zone",
      timezoneAuto: "My zone ({tz})",
      timezoneStudio: "Studio ({tz})",
      timezoneAmericas: "Americas",
      timezoneEurope: "Europe",
      timezone: "Times shown in {tz}",
      legend: "Legend",
    },
    grid: {
      label: "Appointments by day",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      cellEmpty: "{date} — no appointments",
      cell: "{date} — {count}",
      cellPending: "{date} — {count}, {pending} awaiting client",
      showAll: "Show all {count} appointments on {date}",
      showFewer: "Show fewer appointments on {date}",
      less: "Less",
      loading: "Loading appointments…",
      empty: "No appointments this month.",
      createOne: "Create one",
    },
    agenda: {
      dayLabel: "{day} — {count}",
      empty: "Nothing scheduled.",
      new: "+ New appointment",
    },
    status: {
      pending: "AWAITING CLIENT",
      awaitingReceipt: "AWAITING RECEIPT",
      confirmed: "CONFIRMED",
      cancelled: "CANCELLED",
    },
    sheet: {
      newTitle: "New appointment",
      editTitle: "Edit appointment",
      fallbackTitle: "Appointment",
      discardTitle: "Discard changes?",
      discardConfirm:
        "Discard your changes to this booking?\n\nNothing has been saved yet.",
      deleteTitle: "Delete this appointment?",
      deleteConfirm:
        "Delete this booking permanently?\n\nThe record and any receipt are " +
        "erased and the link dies. Use Cancel booking instead if you only want " +
        "to free the slot — that one is reversible.",
      notLoaded: "This appointment is no longer loaded.",
      loadingOne: "Loading this appointment…",
      loadFailed: "This appointment could not be loaded.",
      created: "Created",
      seed: "Studio seed",
      client: "Client",
      message: "Message",
      termsAccepted: "Terms accepted",
      termsPending: "Terms not accepted yet",
      notes: "Private notes",
      restore: "Restore",
      cancelBooking: "Cancel booking",
    },
    form: {
      date: "Date",
      starts: "Starts",
      lasts: "Lasts",
      duration: "Duration",
      ends: "Ends",
      nextDay: "Next day",
      timeZone: "Appointment time zone",
      timeZoneHint:
        "The zone the session happens in — the times above are in it.",
      timeZoneStudio: "Same as the studio ({tz})",
      timeZoneCurrent: "My current zone ({tz})",
      timeZoneChip: "in {abbrev}",
      timeZoneInvalid: "Invalid time zone — pick another one.",
      chipCustom: "custom",
      endBeforeStart: "End must be after start",
      overlap: "⚠ Overlaps {range} · {name}",
      contactHint: "At least one required",
      contactGroup: "Contact — fill in at least one of the two",
      contactRequired:
        "Add an Instagram handle or an email — at least one is required.",
      depositCurrency: "Deposit currency",
      invalidAmount: "Invalid amount — 50.000 or 50000,50",
      notes: "Notes",
      notesHint: "Private — never shown to the client.",
      create: "Create appointment",
      saveChanges: "Save changes",
    },
    link: {
      title: "Private link",
      inputLabel: "Private booking link ({locale})",
      copy: "Copy",
      copied: "Copied ✓",
      share: "Share",
      whatsapp: "WhatsApp",
      rotate: "Rotate link",
      rotateTitle: "Issue a new link?",
      rotateConfirm:
        "Rotate this link?\n\nEvery link already sent for this booking stops " +
        "working immediately — WhatsApp, email, anything. You will have to send " +
        "the new one.",
    },
    receipt: {
      title: "Receipt",
      empty: "Nothing uploaded yet.",
      pdf: "PDF",
      imageAlt: "Transfer receipt: {filename}",
      upload: "Attach a receipt",
      uploading: "Uploading…",
      uploadFailed: "The receipt could not be uploaded.",
      delete: "Delete receipt",
      deleteTitle: "Delete this receipt?",
      deleteConfirm:
        "Delete this receipt?\n\nThe file is erased from storage and the " +
        "booking drops back to {status}, so the client can upload another one.",
    },
    emails: {
      heading: "Email",
      ownerSubmitted: "Owner · submitted",
      clientSubmitted: "Client · submitted",
      ownerConfirmed: "Owner · confirmed",
      clientConfirmed: "Client · confirmed",
      notSent: "not sent",
      resend: "Resend",
    },
  },

  trips: {
    manage: "Trips",
    title: "Trips",
    empty:
      "No trips yet. A trip marks the days you are in another city: bookings " +
      "on those dates start in that zone, and it warns you when one ended up " +
      "in a different one.",
    newTrip: "New trip",
    editTrip: "Edit trip",
    namePlaceholder: "Berlín",
    timeZone: "Zone",
    from: "From",
    to: "To",
    editOne: "Edit {label}",
    deleteOne: "Delete {label}",
    deleteTitle: "Delete this trip?",
    deleteConfirm:
      "Delete \"{label}\"?\n\nNo booking changes: the ones already made keep " +
      "the zone they have. You only lose the default zone and the warning for " +
      "the next ones.",
    band: "✈ {label}",
    zoneMismatch:
      "⚠ You are in {trip} that day, but this booking is in {tz}. Is that right?",
    errors: {
      invalidRange: "Invalid dates — the end cannot be before the start.",
      labelTooLong: "The name cannot be longer than {max} characters.",
      invalidTimeZone: "Invalid trip time zone — pick another one.",
    },
  },

  settings: {
    title: "Studio settings",
    saved: "Settings saved ✓",
    saveFailed: "The settings could not be saved.",
    sections: {
      email: "Email",
      transfer: "Bank transfer",
      mercadopago: "MercadoPago",
      studio: "Studio address",
    },
    fields: {
      senderEmail: "Sender address",
      senderName: "Sender name",
      notifyEmail: "Notifications to",
      alias: "Alias",
      cbu: "CBU",
      holder: "Account holder",
      bank: "Bank",
      address: "Street address",
      arrivalNote: "Arrival note",
    },
    toggles: {
      transfer: "Offer bank transfer",
      mercadopago: "Offer MercadoPago",
    },
    hints: {
      email: "Leave a field empty to fall back to the site address.",
      mercadopago:
        "The MercadoPago access token is configured in the hosting " +
        "environment, not here.",
      studio:
        "Only a client whose booking is confirmed — terms accepted and deposit " +
        "settled — ever sees this, on their private booking page and in their " +
        "confirmation email. It never appears on the public site. Leave it " +
        "empty and no address is shown at all.",
      arrivalNote:
        "Buzzer, floor, the nearest corner — whatever helps someone find the door.",
    },
    errors: {
      invalidEmail: "That email address is not valid.",
      invalidCbu: "A CBU is 22 digits long.",
    },
  },

  login: {
    title: "Sign in",
    password: "Password",
    wrongPassword: "Wrong password.",
    submit: "Enter",
  },

  install: {
    title: "Add the admin to your home screen",
    action: "Install",
    ios: "Tap Share, then “Add to Home Screen”.",
    dismiss: "Don't show again",
  },
};

const ADMIN_DICTIONARIES: Record<Locale, AdminDictionary> = {
  es: adminEs,
  en: adminEn,
};

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return ADMIN_DICTIONARIES[locale];
}

export { adminEs, adminEn };
