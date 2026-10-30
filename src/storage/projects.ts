// project index: which scripts exist and which one is open.
// lives in localStorage ('sf-projects'); the script bodies live in IndexedDB.
import { listDocIds, loadDoc } from './db'

export interface ProjectEntry {
  id: string
  title: string
  updatedAt: number
}

export interface ProjectIndex {
  activeId: string
  projects: ProjectEntry[]
}

const KEY = 'sf-projects'

export function readIndex(): ProjectIndex | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as ProjectIndex).activeId !== 'string' ||
      !Array.isArray((parsed as ProjectIndex).projects)
    ) {
      return null
    }
    return parsed as ProjectIndex
  } catch {
    return null
  }
}

export function writeIndex(idx: ProjectIndex): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(idx))
  } catch {
    // storage unavailable — session keeps the in-memory index
  }
}

export function addProject(idx: ProjectIndex, id: string, title: string): ProjectIndex {
  return { ...idx, projects: [...idx.projects, { id, title, updatedAt: Date.now() }] }
}

export function renameProject(idx: ProjectIndex, id: string, title: string): ProjectIndex {
  return {
    ...idx,
    projects: idx.projects.map((p) => (p.id === id ? { ...p, title } : p)),
  }
}

export function removeProject(idx: ProjectIndex, id: string): ProjectIndex {
  return { ...idx, projects: idx.projects.filter((p) => p.id !== id) }
}

export function setActive(idx: ProjectIndex, id: string): ProjectIndex {
  return { ...idx, activeId: id }
}

// first run after this feature ships: build the index from whatever the
// store already holds (the pre-projects single doc lives at 'current')
export async function ensureIndex(): Promise<ProjectIndex> {
  const existing = readIndex()
  if (existing) return existing
  const ids = await listDocIds()
  const projects: ProjectEntry[] = []
  for (const id of ids) {
    if (id === INDEX_KEY) continue
    const doc = await loadDoc(id)
    projects.push({ id, title: doc?.meta.title || 'Untitled screenplay', updatedAt: Date.parse(doc?.meta.modified ?? '') || 0 })
  }
  // the pre-projects record is the active one; otherwise the first stored
  const activeId = projects.some((p) => p.id === CURRENT_KEY) ? CURRENT_KEY : (projects[0]?.id ?? '')
  const idx: ProjectIndex = { activeId, projects }
  writeIndex(idx)
  return idx
}

export const INDEX_KEY = 'index'
export const CURRENT_KEY = 'current'
