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
  /** The three tabs in AdminNav. Also the h1 of each page they lead to. */
  nav: {
    calendar: string;
    images: string;
    categories: string;
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
      discardConfirm: string;
      /**
       * confirm() before the irreversible delete. It names the reversible
       * alternative in prose — keep that phrase in step with `cancelBooking`.
       */
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
      rotateConfirm: string;
    };
    receipt: {
      title: string;
      empty: string;
      /** A format name, not a word. */
      pdf: string;
      /** alt text for the uploaded image. `{filename}` as the client sent it. */
      imageAlt: string;
      delete: string;
      /** confirm(). `{status}` is `status.awaitingReceipt` — the state it falls back to. */
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

  login: {
    title: string;
    password: string;
    /** The only login failure the page distinguishes. */
    wrongPassword: string;
    submit: string;
  };
};

const adminEs: AdminDictionary = {
  nav: {
    calendar: "Calendario",
    images: "Imágenes",
    categories: "Categorías",
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
      discardConfirm:
        "¿Descartar los cambios de este turno?\n\nTodavía no se guardó nada.",
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
      delete: "Eliminar comprobante",
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

  login: {
    title: "Iniciar sesión",
    password: "Contraseña",
    wrongPassword: "Contraseña incorrecta.",
    submit: "Entrar",
  },
};

const adminEn: AdminDictionary = {
  nav: {
    calendar: "Calendar",
    images: "Images",
    categories: "Categories",
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
      discardConfirm:
        "Discard your changes to this booking?\n\nNothing has been saved yet.",
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
      delete: "Delete receipt",
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

  login: {
    title: "Sign in",
    password: "Password",
    wrongPassword: "Wrong password.",
    submit: "Enter",
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
