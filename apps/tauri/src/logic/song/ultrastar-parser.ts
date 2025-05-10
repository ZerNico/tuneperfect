import { ofetch } from 'ofetch'
import { Md5 } from 'ts-md5'
import type { FileEntry } from '@tauri-apps/api/fs'
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri'

import type { NoteType } from './note'
import { Note } from './note'
import { Sentence } from './sentence'
import { Voice } from './voice'
import { LocalSong, metaSchema, urlsSchema } from './song'

class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export const parseTree = async (tree: FileEntry) => {
  if (!tree?.children) return []

  const txts: { file: FileEntry; parent: FileEntry }[] = []

  // go through all directories and files (recursively) and find all .txt files, then store them in txts to get the parent folder, you have to save the parent temporarily in a variable
  let parentFolder: FileEntry | null = null
  const findTxts = (tree: FileEntry) => {
    if (tree.children !== undefined) {
      parentFolder = tree
      tree.children?.forEach(findTxts)
    } else if (tree.path.endsWith('.txt') && parentFolder) {
      txts.push({ file: tree, parent: parentFolder })
    }
  }
  findTxts(tree)

  const results = await Promise.allSettled(txts.map(({ file, parent }) => parseLocalSong(file, parent)))

  const fulfilled = results.filter((result) => result.status === 'fulfilled') as PromiseFulfilledResult<LocalSong>[]

  const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
  rejected.forEach((result) => {
    console.error(result.reason)
  })

  const songs = fulfilled.map((result) => result.value)
  return songs
}

const parseLocalSong = async (songFile: FileEntry, parentFolder: FileEntry) => {
  try {
    const assetUrl = convertFileSrc(songFile.path, 'stream')

    const song: string = await ofetch(assetUrl, { parseResponse: (txt) => txt })
    const { data, fileNames, voices } = parseSongTxt(song)

    const urls: any = {}
    // find paths for all files in the parent folder using the file names from the parsed song
    const findFile = (name: string) => {
      const file = parentFolder.children?.find((file) => file.name?.toLowerCase() === name.toLowerCase())
      if (file) return file.path
      return null
    }
    // generate an object of the atom urls for the song
    let k: keyof typeof fileNames

    for (k in fileNames) {
      const fileName = fileNames[k]
      if (typeof fileName === 'string') {
        const path = findFile(fileName)

        if (path) {
          urls[k] = convertFileSrc(path, 'stream')
        }
      }
    }

    const validatedUrls = urlsSchema.parse(urls)

    const replayGain = await invoke<number>('get_replaygain', { path: validatedUrls.mp3 })

    const localSong = new LocalSong(data, validatedUrls, voices, { replayGain })
    return localSong
  } catch (error) {
    let message = 'Unknown error'
    if (error instanceof Error) {
      message = error.message
    }
    throw new ParseError(`Error parsing song ${songFile.name}: ${message}`)
  }
}

const parseSongTxt = (txt: string) => {
  const meta: any = {
    relative: false,
  }
  const fileNames: any = {}

  let notes: Note[] = []
  let sentences: Sentence[] = []
  const voices: Voice[] = []
  const md5 = new Md5()

  // split the text into lines
  const lines: string[] = txt.split(/\r?\n/)

  lines.forEach((line) => {
    if (line === '') return
    if (line.startsWith('#')) {
      const [property, v]: string[] = line.substring(1, line.length).trim().split(':')
      const value = v.trim()

      switch (property.toLocaleLowerCase()) {
        case 'title':
          meta.title = value
          break
        case 'artist':
          meta.artist = value
          break
        case 'language':
          meta.language = value
          break
        case 'edition':
          meta.edition = value
          break
        case 'genre':
          meta.genre = value
          break
        case 'year':
          meta.year = value
          break
        case 'bpm':
          meta.bpm = value.replace(',', '.')
          break
        case 'gap':
          meta.gap = value.replace(',', '.')
          break
        case 'mp3':
          fileNames.mp3 = value
          break
        case 'audio':
          fileNames.mp3 = value
          break
        case 'cover':
          fileNames.cover = value
          break
        case 'video':
          fileNames.video = value
          break
        case 'background':
          fileNames.background = value
          break
        case 'relative':
          meta.relative = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true'
          break
        case 'videogap':
          meta.videoGap = value.replace(',', '.')
          break
        case 'author':
          meta.author = value
          break
      }
    } else if ([':', '*', 'F', 'R', 'G'].includes(line.charAt(0))) {
      const [tag, startBeat, length, txtPitch, ...text] = line.substring(0, line.length).split(' ')
      const note = new Note(
        tagToNoteType(tag),
        parseInt(startBeat),
        parseInt(length),
        parseInt(txtPitch),
        text.join(' ')
      )
      notes.push(note)
      md5.appendStr(line)
    } else if (line.charAt(0) === '-') {
      const [, linebreakBeat]: string[] = line.substring(1, line.length).split(' ')
      sentences.push(new Sentence(notes, parseInt(linebreakBeat)))
      notes = []
      md5.appendStr(line)
    } else if (line.charAt(0) === 'P') {
      if (sentences.length === 0) return
      const lastNote: Note = notes[notes.length - 1]
      if (notes.length !== 0) {
        sentences.push(new Sentence(notes, lastNote.startBeat + lastNote.length + 1))
      }
      voices.push(new Voice(sentences))
      notes = []
      sentences = []
    } else if (line.charAt(0) === 'E') {
      if (notes.length > 0) {
        const lastNote: Note = notes[notes.length - 1]
        sentences.push(new Sentence(notes, lastNote.startBeat + lastNote.length + 1))
      }

      notes = []
      voices.push(new Voice(sentences))

      meta.hash = md5.end()?.toString()
    }
  })

  const validatedMeta = metaSchema.parse(meta)
  const validatedFileNames = urlsSchema.parse(fileNames)

  return { data: validatedMeta, fileNames: validatedFileNames, voices }
}

function tagToNoteType(tag: string): NoteType {
  switch (tag.toUpperCase()) {
    case ':':
      return 'Normal'
    case '*':
      return 'Golden'
    case 'F':
      return 'Freestyle'
    // Use Rap notes as Freestyle notes for now
    case 'R':
      // return 'Rap'
      return 'Freestyle'
    case 'G':
      // return 'RapGolden'
      return 'Freestyle'
  }
  return 'Normal'
}
