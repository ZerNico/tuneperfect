const en = {
  common: {
    notifications: {
      success: "Success",
      error: "Error",
      info: "Info",
      warning: "Warning"
    },
    keyHints: {
      navigate: "Navigate",
      confirm: "Confirm",
      back: "Back"
    },
    players: {
      guest: "Guest"
    }
  },
  home: {
    title: "Welcome",
    startGame: "Start Game",
    joinLobby: "Join Lobby",
    party: "Party",
    singDescription: "Sing your favorite songs, alone or with your friends!",
    partyDescription: "Battle it out with your friends in one of the different party game modes!",
    lobbyDescription: "Manage the party you are in and invite your friends.",
    settingsDescription: "Change your settings or add your songs and microphones.",
    microphoneRequired: "You have no microphones configured. Go to settings to add one."
  },
  lobby: {
    title: "Lobby",
  },
  sing: {
    title: "Sing",
    songs: "Songs",
    search: "Search",
    players: "Players",
    player: "Player",
    voice: "Voice",
    start: "Start",
    random: "Random",
    sort: {
      artist: "Artist",
      title: "Title",
      year: "Year"
    }
  },
  score: {
    title: "Score",
    continue: "Continue",
    normal: "Normal",
    golden: "Golden",
    bonus: "Bonus"
  },
  game: {
    pause: {
      resume: "Resume",
      exit: "Exit"
    }
  },
  settings: {
    title: "Settings",
    add: "Add",
    save: "Save",
    remove: "Remove",
    delete: "Delete",
    sections: {
      general: {
        title: "General",
        language: "Language"
      },
      songs: {
        title: "Songs"
      },
      microphones: {
        title: "Microphones",
        name: "Name",
        device: "Device",
        microphone: "Microphone",
        channel: "Channel",
        player: "Player",
        color: "Color",
        delay: "Delay",
        gain: "Gain",
        threshold: "Threshold"
      },
      volume: {
        title: "Volume",
        master: "Master Volume",
        game: "Game Volume",
        preview: "Preview Volume",
        menu: "Menu Volume"
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
      jokers: "Jokers",
      notEnoughPlayers: "Not enough players. You need at least 2 players to start a versus game.",
      exit: "Exit",
      continue: "Continue",
      draw: "It's a draw",
      wins: "wins"
    }
  }
};

export type Dict = typeof en;
export type DictEn = typeof en;
export const dict = en;
