const de = {
  common: {
    notifications: {
      success: "Erfolg",
      error: "Fehler",
      info: "Info",
      warning: "Warnung"
    },
    keyHints: {
      navigate: "Navigieren",
      confirm: "Bestätigen",
      back: "Zurück"
    },
    players: {
      guest: "Gast",
    }
  },
  home: {
    title: "Willkommen",
    startGame: "Spiel starten",
    joinLobby: "Lobby beitreten",
    party: "Party",
    singDescription: "Singe deine Lieblingslieder, allein oder mit Freunden!",
    partyDescription: "Tritt gegen deine Freunde in verschiedenen Party-Spielmodi an!",
    lobbyDescription: "Verwalte deine Party und lade deine Freunde ein.",
    settingsDescription: "Ändere deine Einstellungen oder füge Lieder und Mikrofone hinzu.",
    microphoneRequired: "Du hast keine Mikrofone konfiguriert. Gehe zu den Einstellungen, um eines hinzuzufügen."
  },
  lobby: {
    title: "Lobby",
  },
  sing: {
    title: "Singen",
    songs: "Lieder",
    search: "Suchen",
    players: "Spieler",
    player: "Spieler",
    voice: "Stimme",
    start: "Starten",
    random: "Zufällig",
    sort: {
      artist: "Künstler",
      title: "Titel",
      year: "Jahr"
    }
  },
  score: {
    title: "Punktzahl",
    continue: "Weiter",
    normal: "Normal",
    golden: "Gold",
    bonus: "Bonus"
  },
  game: {
    pause: {
      resume: "Fortsetzen",
      exit: "Beenden"
    }
  },
  settings: {
    title: "Einstellungen",
    add: "Hinzufügen",
    save: "Speichern",
    remove: "Entfernen",
    delete: "Löschen",
    sections: {
      general: {
        title: "Allgemein",
        language: "Sprache"
      },
      songs: {
        title: "Lieder"
      },
      microphones: {
        title: "Mikrofone",
        name: "Name",
        device: "Gerät",
        microphone: "Mikrofon",
        channel: "Kanal",
        player: "Spieler",
        color: "Farbe",
        delay: "Verzögerung",
        gain: "Verstärkung",
        threshold: "Schwellenwert"
      },
      volume: {
        title: "Lautstärke",
        master: "Gesamtlautstärke",
        game: "Spiellautstärke",
        preview: "Vorschaulautstärke",
        menu: "Menülautstärke"
      },
      credits: {
        title: "Credits",
      },
    }
  },
  party: {
    title: "Party",
    versus: {
      title: "Versus",
      start: "Start",
      jokers: "Joker",
      notEnoughPlayers: "Nicht genug Spieler. Du brauchst mindestens 2 Spieler zum Starten eines Versus-Spiels.",
      microphoneRequired: "Du brauchst 2 Mikrofone zum Starten eines Versus-Spiels.",
      exit: "Beenden",
      continue: "Weiter",
      restart: "Neustart",
      draw: "Unentschieden",
      wins: "hat gewonnen"
    }
  }
};

export type Dict = typeof de;
export type DictDe = typeof de;
export const dict = de;
