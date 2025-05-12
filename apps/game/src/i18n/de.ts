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
    settingsDescription: "Ändere deine Einstellungen oder füge Lieder und Mikrofone hinzu."
  },
  lobby: {
    title: "Lobby",
  },
  sing: {
    title: "Singen",
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
};

export type Dict = typeof de;
export type DictDe = typeof de;
export const dict = de;
