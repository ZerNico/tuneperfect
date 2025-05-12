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
    settingsDescription: "Change your settings or add your songs and microphones."
  },
  lobby: {
    title: "Lobby",
  },
  sing: {
    title: "Sing",
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
};

export type Dict = typeof en;
export type DictEn = typeof en;
export const dict = en;
